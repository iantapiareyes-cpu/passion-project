# Running this project on Replit

This is the Football Passion web app. The `Start application` workflow runs it
with `PORT=5000 npm run dev`, which serves the app in Replit's web preview.

After syncing changes from GitHub, refresh the preview to load the updated
files. If it still shows the previous version, restart the `Start application`
workflow and refresh again. Syncing updates the Replit workspace; it does not
publish or deploy the app.

## GitHub backup branch

Use `origin/feature-branch-2` as a backup of `main`. After changes are committed
or synced to `main`, fast-forward `feature-branch-2` to the same commit and
verify the remote branch. Never force-push or overwrite commits that exist only
on the backup branch; if the branches diverge or the push fails, stop and ask
before proceeding.
