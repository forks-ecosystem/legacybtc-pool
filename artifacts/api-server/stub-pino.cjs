const noop = () => undefined;
const logger = () => ({
  info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop,
  child: () => ({
    info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop,
    child: logger(),
  }),
  level: "silent",
});
module.exports = logger;
module.exports.default = logger;
