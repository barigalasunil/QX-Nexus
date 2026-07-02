# QX Nexus Architecture Notes

QX Nexus uses a feature-based frontend structure. Runtime screens live under `src/features`, shared UI lives under `src/components`, and future backend boundaries are reserved under `src/repositories` and `src/services`.

The current persistence layer is browser localStorage. Keep storage access isolated as new repositories are introduced.
