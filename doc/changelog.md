# Changelog

All notable changes to this project are recorded here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added
- **Gym & Trainer Ratings and Reviews Subsystem Specification** ([`doc/RATINGS_AND_REVIEWS_SPECIFICATION.md`](./RATINGS_AND_REVIEWS_SPECIFICATION.md)): comprehensive documentation of the dual-entity reputation engine, embedded `reviewSchema` architecture, arithmetic rating averages, star distribution histograms (5★ down to 1★), dynamic `computeTimeAgo` engine, public and authenticated REST endpoints, and cross-platform UI implementations.
- **Ratings & Reviews Automated Unit Tests** ([`middleware/test/gym_reviews_ratings.test.js`](../middleware/test/gym_reviews_ratings.test.js)): test suite covering endpoint routes, `computeTimeAgo` human-readable strings, star histogram percentages, and 1 to 5 star boundary constraints.

### Changed
- Synchronized `README.md` and `doc/README.md` to index the new ratings & reviews specification and documented the reputation engine under core platform technologies.

