# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Owner-Isolated Cloud Saves (`/saves/{userId}`)**: Only an email-verified authenticated user whose `request.auth.uid == userId` may read, create, update, or delete their own save document. `ownerId` is immutable and must equal `userId`.
2. **Strict PII Isolation (`/users_private/{userId}`)**: Email addresses and privacy consent logs are stored exclusively in `/users_private/{userId}` and are strictly inaccessible to any user other than the owner (`request.auth.uid == userId`).
3. **Zero-PII Public Leaderboard (`/leaderboard/{userId}`)**: Public leaderboard entries contain zero PII (`email`, `phone`, `address` forbidden via `keys().hasOnly(...)`). Only the owner (`request.auth.uid == userId`) can create, update, or delete their entry, and `highScore` / `bestDistance` are bounded integers (`0 <= val <= 100000000`).
4. **Verified Friendships (`/friendships/{friendshipId}`)**: A player can only create a friendship where `requesterId == request.auth.uid`, `requesterId != targetId`, and `exists(/databases/$(database)/documents/leaderboard/$(targetId))`. Only `requesterId` or `targetId` can list, read, or delete the friendship; only `targetId` can transition `status` from `'pending'` to `'accepted'`.
5. **Server Timestamp Integrity**: Every `createdAt` on create and `updatedAt` on create/update must equal `request.time`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Shadow Field Injection on Save Create**: `{ ownerId: uid, ..., isAdmin: true }` -> Blocked by `keys().hasOnly(...)`.
2. **UID Spoofing on Save Create**: `{ ownerId: "other-uid", ... }` written to `/saves/{uid}` -> Blocked by `data.ownerId == request.auth.uid`.
3. **Unverified Email Write**: Authenticated token with `email_verified: false` writing to `/saves/{uid}` -> Blocked by `isVerified()`.
4. **PII Blanket Read Attack**: User B calling `get(/users_private/{userA})` -> Blocked by `isOwner(userId)`.
5. **Save Scraping Attack**: User B calling `list(/saves)` -> Blocked by missing `allow list` (default deny).
6. **Oversized ID Poisoning**: Request to `/saves/{1500_char_string}` -> Blocked by `isValidId(userId)`.
7. **Array Exhaustion on `ownedSkins`**: `{ ownedSkins: [25 strings] }` -> Blocked by `ownedSkins.size() <= 12`.
8. **Score Overflow / Negative Coins**: `{ coins: -500 }` or `{ highScore: 999999999999 }` -> Blocked by numeric bounds.
9. **Immutable Owner Mutation**: Update on `/saves/{uid}` changing `ownerId` or `createdAt` -> Blocked by `affectedKeys().hasOnly(...)` & immutability check.
10. **Client-Spoofed Timestamp**: Update on `/leaderboard/{uid}` with `updatedAt: "2020-01-01"` -> Blocked by `incoming().updatedAt == request.time`.
11. **Self-Accepting Friend Request**: Requester attempting to create a friendship with `status: "accepted"` -> Blocked by `incoming().status == "pending"` on create, or `requesterId` trying to update `status` -> Blocked by `request.auth.uid == existing().targetId`.
12. **Orphan Friendship Creation**: Creating a friendship targeting a non-existent `targetId` -> Blocked by `exists(/databases/$(database)/documents/leaderboard/$(incoming().targetId))`.
