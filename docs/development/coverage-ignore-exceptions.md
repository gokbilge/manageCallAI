# Coverage Ignore Exceptions

Coverage ignore comments must be rare and reviewed. Add exceptions here only when the ignored branch is generated, unreachable defensive code, a platform-specific fallback tested elsewhere, or type-only glue that cannot execute.

Current approved exceptions: none.

Format:

```text
path/to/file.ts:123 - Reason and compensating test, if any.
```
