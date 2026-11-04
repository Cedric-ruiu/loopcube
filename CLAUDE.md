# LoopCube

- [docs/SPEC.md](docs/SPEC.md) is the reference for what the app does. When in doubt, it prevails, including over the reference images. When a change alters behavior it describes, update it in the same commit.
- [README.md](README.md) covers the stack, commands, architecture and branches.
- Reference images are in `docs/reference/`, ignored by git: two are stock images, never copy them into the repo or the site.
- Stack choices: modern, the simplest to maintain and evolve, not the developer's habits.
- Code comments: the bare minimum, only for complex parts, in English.
- Run `yarn check` and `yarn test` before committing.
- Check visual changes with the `dev-browser` skill.
