import { randomBytes, randomInt, createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import {
  partnerInvitations, relationshipsById, relationshipConsents, activeRelationshipByUser,
} from '../data/store';
import { ConsentType, DEFAULT_CONSENT, PartnerInvitation, Relationship } from '../types/astrology';

const CODE_LENGTH = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
const EXPIRY_MINUTES = 30;
const MAX_ATTEMPTS = 5;
const CONSENT_VERSION = 'v1';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export class InvitationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

/** Returns the plaintext code ONCE - only the hash is persisted, matching the
 * "don't store invitation codes in plaintext" requirement. */
export function createInvitation(inviterUserId: string): { invitation: PartnerInvitation; plaintextCode: string } {
  if (activeRelationshipByUser.has(inviterUserId)) {
    throw new InvitationError('You already have an active partner connection.', 'ALREADY_CONNECTED');
  }

  const plaintextCode = generateCode();
  const invitation: PartnerInvitation = {
    id: uuid(),
    inviterUserId,
    codeHash: hashCode(plaintextCode),
    expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString(),
    acceptedAt: null,
    acceptedByUserId: null,
    revokedAt: null,
    status: 'pending',
    attemptCount: 0,
    createdAt: new Date().toISOString(),
  };
  partnerInvitations.set(invitation.id, invitation);
  return { invitation, plaintextCode };
}

export function revokeInvitation(invitationId: string, requesterUserId: string): PartnerInvitation {
  const inv = partnerInvitations.get(invitationId);
  if (!inv || inv.inviterUserId !== requesterUserId) {
    throw new InvitationError('Invitation not found.', 'NOT_FOUND');
  }
  if (inv.status !== 'pending') {
    throw new InvitationError('Only a pending invitation can be revoked.', 'INVALID_STATE');
  }
  inv.status = 'revoked';
  inv.revokedAt = new Date().toISOString();
  return inv;
}

/** Synchronous by design: Node's single-threaded event loop means this function
 * runs to completion without interleaving, which is what makes "find invitation,
 * check state, create relationship, mark accepted" atomic here without a DB
 * transaction. A real Postgres-backed version should wrap this in a transaction. */
export function acceptInvitation(plaintextCode: string, accepterUserId: string): Relationship {
  const codeHash = hashCode(plaintextCode.toUpperCase().trim());
  const invitation = [...partnerInvitations.values()].find((i) => i.codeHash === codeHash);

  if (!invitation) {
    throw new InvitationError('Invalid invitation code.', 'INVALID_CODE');
  }

  if (invitation.status === 'pending' && new Date(invitation.expiresAt) < new Date()) {
    invitation.status = 'expired';
  }

  if (invitation.status !== 'pending') {
    throw new InvitationError(`This invitation is ${invitation.status}.`, 'INVALID_STATE');
  }

  invitation.attemptCount += 1;
  if (invitation.attemptCount > MAX_ATTEMPTS) {
    invitation.status = 'revoked';
    invitation.revokedAt = new Date().toISOString();
    throw new InvitationError('Too many attempts - this invitation has been revoked.', 'TOO_MANY_ATTEMPTS');
  }

  if (invitation.inviterUserId === accepterUserId) {
    throw new InvitationError('You cannot connect with your own account.', 'SELF_PAIR');
  }

  if (activeRelationshipByUser.has(accepterUserId) || activeRelationshipByUser.has(invitation.inviterUserId)) {
    throw new InvitationError('One of these accounts already has an active connection.', 'ALREADY_CONNECTED');
  }

  const relationship: Relationship = {
    id: uuid(),
    userAId: invitation.inviterUserId,
    userBId: accepterUserId,
    status: 'active',
    createdAt: new Date().toISOString(),
    disconnectedAt: null,
    consentVersion: CONSENT_VERSION,
  };
  relationshipsById.set(relationship.id, relationship);
  activeRelationshipByUser.set(relationship.userAId, relationship.id);
  activeRelationshipByUser.set(relationship.userBId, relationship.id);

  for (const userId of [relationship.userAId, relationship.userBId]) {
    for (const [consentType, enabled] of Object.entries(DEFAULT_CONSENT) as [ConsentType, boolean][]) {
      const key = `${relationship.id}:${userId}:${consentType}`;
      relationshipConsents.set(key, {
        relationshipId: relationship.id,
        userId,
        consentType,
        enabled,
        consentVersion: CONSENT_VERSION,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  invitation.status = 'accepted';
  invitation.acceptedAt = new Date().toISOString();
  invitation.acceptedByUserId = accepterUserId;

  return relationship;
}

export function disconnectRelationship(relationshipId: string, requesterUserId: string): Relationship {
  const rel = relationshipsById.get(relationshipId);
  if (!rel || (rel.userAId !== requesterUserId && rel.userBId !== requesterUserId)) {
    throw new InvitationError('Relationship not found.', 'NOT_FOUND');
  }
  if (rel.status === 'disconnected') return rel;

  rel.status = 'disconnected';
  rel.disconnectedAt = new Date().toISOString();
  activeRelationshipByUser.delete(rel.userAId);
  activeRelationshipByUser.delete(rel.userBId);
  return rel;
}
