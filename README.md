# GQ DevTools Lab - Manual QA Training

## Run locally

```bash
node server.js
```

Open:

```text
http://localhost:3000
```

If port 3000 is already in use:

```bash
PORT=3100 node server.js
```

## Teacher Mode

Teacher solutions are hidden by default and are fetched from the server only after teacher authentication.

Default local teacher PIN:

```text
GQ2026
```

For classroom/deployed use, set your own PIN before starting the server:

```bash
TEACHER_PIN="your-private-pin" node server.js
```

The teacher session lasts up to 8 hours in the current browser session. Use **Lock solutions** when finished.

Teacher Mode includes a solution for every Elements, Console, Network and Final Investigation exercise, with:

- How to solve the exercise
- Exact Console command/script when relevant
- What to inspect in Network
- Expected QA conclusion

## Important training concept

Console/API scripts in this lab are used to create **test preconditions and test data faster**. They do not replace manual testing of the functionality that is actually under test.

Example: if the test target is Policy Cancellation, a tester may create an ACTIVE policy via Console/API, then perform and verify the cancellation manually through the UI.
