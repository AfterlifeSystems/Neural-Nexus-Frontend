# Inert salvaged code in this repository

**Read this before deleting anything that looks like unused code, and before
building an avatar storage panel or an adapter-training card from scratch.**

Some complete, reviewed components live in this repository in an **inert**
state: they are present and they build, but nothing imports or renders them, so
no behaviour changes. They are here because they were recovered from commits
that were reachable from no branch at all and were minutes-to-weeks away from
being garbage collected.

Inert code is **not** dead code. Do not delete it, and do not reimplement a
feature listed here — activate the existing component instead.

## How to activate

On an explicit instruction to turn one of these on ("show avatar storage in
settings", "add the adapter card"), import the component into
`src/components/AvatarSettings.jsx` and render it beside the other cards:

```jsx
<AvatarStoragePanel assistantId={assistantId} user={user} />
<AvatarAdapterCard assistantId={assistantId} user={user} />
```

**The API endpoints these call are not served yet.** They are inert on the API
side too, on routers that `webapp.py` never registers. Rendering either
component before the API side is activated gives a panel that fails every
request. Read `src/api/salvage/README.md` in the API repository (`f-anubis`)
first — activation is a checklist on both sides.

Do not activate any of this incidentally or because it looks unfinished. It is
finished; it is switched off on purpose.

## What is currently inert

| File | Role | Recovered from |
|---|---|---|
| `src/services/avatarStorageAndAdapter.js` | The six API calls both components use | `c62c798`, `d8d2c93` |
| `src/components/salvage/AvatarStoragePanel.jsx` | Bytes used against the tier allotment, add-on pack purchase | `c62c798` |
| `src/components/salvage/AvatarAdapterCard.jsx` | Adapter status, train / retrain / cancel, live training progress | `d8d2c93` |

Upstream these were fragments spliced directly into `AvatarSettings.jsx`
(`renderStorageCard`, `renderAdapterCard`, and their state, effects and
handlers) and functions added to `avatarService.jsx`. They were reconstituted
as self-contained components in their own directory so that salvaging them
touched neither of those two heavily-edited files. On activation, the service
functions can be folded back into `avatarService.jsx` and this module deleted.

## Related feature status, so it is not rebuilt by mistake

The **message feedback** UI from the same origin commit (`d8d2c93`) is already
live in this repository — thumbs, ratings, comments and the "feels real" mark
in `src/components/media/MessageActionBar.jsx`, backed by `/message_feedback`.
Only the adapter card from that commit was left behind. Likewise the geo-located
avatar and deep-research UIs from the sibling commits `519d84d` and `ba780c1`
are fully live. Do not re-port any of those.

## How to tell inert code apart

Every inert file opens with a comment block beginning `INERT SALVAGE`.
Components live under `src/components/salvage/`. Confirm inertness with:

```bash
grep -rn "avatarStorageAndAdapter\|components/salvage" src/ \
  | grep -v "^src/components/salvage/"
```

Output limited to the module's own header comment means nothing live
references any of it.
