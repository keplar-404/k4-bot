# Keys

Create, list and revoke API keys under /v1/account/keys.

API keys are managed in the portal at [platform.simular.ai](https://platform.simular.ai). The endpoints below are what the portal calls. They accept a Firebase session only: an API key cannot manage keys.

## Limits

| Plan | Live keys | Creation rate |
| ---- | --------- | ------------- |
| Free | 1         | 5 per hour    |
| Paid | 20        | 5 per hour    |

Free accounts must verify a phone number first.

## Create a key

```bash title="Create a key"
curl -s "$SAI_API_URL/v1/account/keys" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "ci" }'
```

`name` is optional, up to 100 characters.

```json title="201 Created · API key"
{ "key": "sapi_...", "keyId": "k_8Hq", "name": "ci" }
```

`key` is returned once. It is not stored in plaintext and cannot be shown again.

| Status | Body                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `403`  | `{ "error": "phone_verification_required", "message": "Verify a phone number before creating an API key on the free plan. If you just verified it, sign in again so your session carries it." }` |
| `403`  | An API key was used instead of a Firebase session.                                                                                                                                               |
| `422`  | `{ "error": "API key limit reached. Maximum 20 keys per account. Revoke an existing key first." }` The free plan says `Maximum 1 keys per account`.                                              |
| `429`  | `{ "error": "Key generation rate limit exceeded. Maximum 5 keys per hour." }`                                                                                                                    |

The phone check reads the phone claim on the sign-in token, so the number must be verified before the current sign-in. If you verified it during this session, sign out and back in, then create the key. It is the same verified number the free computer's claim checks.

## List keys

```bash title="List your keys"
curl -s "$SAI_API_URL/v1/account/keys" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

```json title="200 OK · API keys"
{
  "keys": [
    {
      "keyId": "k_8Hq",
      "name": "ci",
      "last4": "AbCd",
      "createdAt": 1790000000000,
      "lastUsedAt": 1790003600000,
      "monthlySpendCapCents": 5000
    },
    {
      "keyId": "k_2Zp",
      "name": null,
      "last4": null,
      "createdAt": 1789000000000,
      "lastUsedAt": null,
      "monthlySpendCapCents": null
    }
  ]
}
```

Newest first. Secrets are never listed, and revoked keys are not listed.

| Field                  | Meaning                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `last4`                | The key's last four characters, to tell keys apart (`sapi_…AbCd`). `null` for older keys.                 |
| `monthlySpendCapCents` | The key's monthly spend limit in US cents, or `null` when none is set. See [Update a key](#update-a-key). |

## Update a key

```bash title="Rename a key and set its spend limit"
curl -s -X PATCH "$SAI_API_URL/v1/account/keys/$KEY_ID" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "ci-prod", "monthlySpendCapCents": 5000 }'
```

Send at least one field; unknown fields are rejected.

- `name`: 1 to 100 characters.
- `monthlySpendCapCents`: an integer from `1` ($0.01) to `100000000` ($1,000,000), or `null` to remove the limit. Keys have no limit by default.

The limit counts the key's model and tool spend in each calendar month in UTC and resets at 00:00 UTC on the 1st. Requests already running when the limit is reached can take spend slightly over it.

Spend limits are rolling out. Until they are available on your account, the key list omits `monthlySpendCapCents` and setting it returns `400`.

`204 No Content`.

| Status | Body                                                    |
| ------ | ------------------------------------------------------- |
| `400`  | The body is empty, has an unknown field or a bad value. |
| `404`  | `{ "error": "API key not found." }`                     |

## Revoke a key

```bash title="Revoke a key"
curl -s -X DELETE "$SAI_API_URL/v1/account/keys/$KEY_ID" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

`204 No Content`. A revoked key fails with `401` on its next use.

| Status | Body                                |
| ------ | ----------------------------------- |
| `404`  | `{ "error": "API key not found." }` |

## From the CLI

The `sai` CLI wraps the same endpoints:

```bash title="Manage keys with the CLI"
sai key generate --name ci
sai key list
sai key revoke <keyId>
```

> **Note**
>
> Free-account keys and the `phone_verification_required` answer are available from October 1.
