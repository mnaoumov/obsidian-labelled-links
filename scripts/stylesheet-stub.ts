/**
 * The unit runners' stand-in for a stylesheet import.
 *
 * `src/main.ts` imports the plugin's stylesheet for its side effect, so that the bundler emits
 * `styles.css` -- and `src/main.test.ts` imports `src/main.ts`. Neither runner should load the real
 * file: jest has no transform for `.css` / `.scss` and parses one as JavaScript, and on `standalone`'s `tailwind`
 * answer the file `src/main.ts` names does not exist until `npm run build:styles` has run. So both
 * runners send every stylesheet import here, exactly as they send every `.svelte` / `.vue` import to
 * `framework-component-stub.ts`.
 *
 * It is an empty class-name map rather than a module that throws: importing a stylesheet is the normal
 * path of every plugin that has one, and a CSS-modules import that reads a class name gets `undefined`
 * instead of a crash.
 */
const stylesheetStub: Readonly<Record<string, string>> = {};

export default stylesheetStub;
