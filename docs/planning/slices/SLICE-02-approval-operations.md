# SLICE-02 Approval Operations

## Goal

Finish the approval lifecycle after `pending_approval` publish / rollback results.

## Scope

- approval list endpoints
- approve / reject endpoints
- audit trail linking approvals to publish records
- tenant or platform review UI
- policy visibility in UI

## Depends On

- `SLICE-00`

## Parallel With

- `SLICE-01`
- `SLICE-03`

## Unblocks

- `SLICE-08`
- `SLICE-09`
- `SLICE-10`
- `SLICE-11`

## Exit Criteria

- a publish request can be approved or rejected end to end
- audit trail is visible
- blocked publish cannot bypass approval policy

## Out Of Scope

- broad enterprise workflow engine
