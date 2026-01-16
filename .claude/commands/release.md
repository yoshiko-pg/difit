Update CHANGELOG.md with all changes from the latest tag to current commit.

First, run the script to get commit information:
```bash
./scripts/get-changes-since-tag.sh
```

Use the script output to categorize changes:
- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities.
- `Thanks` for contributors mention with GitHub username and PR number

When processing commits:
1. Use the GitHub username from script output (not git commit author names)
2. Only include contributors in Thanks section (exclude yoshiko-pg as that's the maintainer)
3. Include PR numbers when available
4. Use commit subject and body to properly categorize changes

Write the categorized changes to the Unreleased section of CHANGELOG.md, then inform the user in Japanese and ask for confirmation with say command. (Don't just output the changes - write them to the file first so the user can review the actual file.)

If confirmed OK:

- npm version --no-git-tag-version patch
- Create a version section in CHANGELOG.md and move Unreleased section content there
- Update the version links at the bottom of CHANGELOG.md (add new version links and update Unreleased link)
- Commit CHANGELOG.md
- create current version git tag
- git push origin main --tags
- create release on github with CHANGELOG.md target version section text (to origin)
