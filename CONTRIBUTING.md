# Contributing to Saiyan Desk Pet

Thank you for your interest in contributing!

## Important: Copyrighted Assets

**Do not attach copyrighted sprite sheets, audio or screenshots containing them. Only original or properly licensed art.**

This includes:
- No official Dragon Ball artwork, sprites, or screenshots
- No Comnyang code or assets
- No sprites extracted from games or anime

If your contribution includes sprite assets, confirm they are original or properly licensed.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/<user>/saiyan-desk-pet.git
cd saiyan-desk-pet

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## Project Structure

See [docs/architecture.md](docs/architecture.md) for the full architecture overview.

## Coding Standards

- TypeScript strict mode
- ESLint + Prettier
- Zod for all input validation
- No `any` types (use `unknown` and narrow)

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure tests pass: `npm test`
5. Ensure lint passes: `npm run lint`
6. Submit a PR with a clear description

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
