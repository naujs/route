var util = require('@naujs/util')
  , _ = require('lodash')
  , Promise = util.getPromise()
  , Property = require('@naujs/property');

class Route {
  constructor(name, definition, handler) {
    this._name = name;
    this._definition = definition;
    this.setHandler(handler);

    this._beforeHooks = [];
    this._afterHooks = [];
    this.enable();
  }

  getPath() {
    return this._definition.path;
  }

  getArgs() {
    if (!this._args) {
      var args = {};
      _.each(this._definition.args, (options, name) => {
        if (_.isString(options)) {
          args[name] = {};
          args[name].type = options;
        } else if (_.isObject(options)) {
          args[name] = options;
        }
      });
      this._args = args;
    }
    return this._args;
  }

  getMethod() {
    return this._definition.method || this._definition.type || 'get';
  }

  isEnabled() {
    return this._enabled;
  }

  disable() {
    this._enabled = false;
  }

  enable() {
    this._enabled = true;
  }

  getName() {
    return this._name;
  }

  setHandler(fn) {
    this._handler = fn;
  }

  getHandler() {
    return this._handler;
  }

  setDefinition(definition) {
    this._definition = definition;
    delete this._args;
  }

  getDefinition() {
    return this._definition;
  }

  setModelClass(cls) {
    this._modelClass = cls;
  }

  getModelClass() {
    return this._modelClass;
  }

  before(fn) {
    this._beforeHooks.push(fn);
  }

  after(fn) {
    this._afterHooks.push(fn);
  }

  _runHooks(hooks, ...args) {
    var fn = hooks.shift();
    if (!fn) {
      return Promise.resolve(null);
    }

    return util.tryPromise(fn(...args)).then(() => {
      return this._runHooks(hooks, ...args);
    }).then(() => {
      return this;
    });
  }

  filterAndValidate(userInputs, ctx) {
    ctx = ctx || {};
    var properties = Property.parse(this.getArgs());
    var filterUserInputs = {};

    var promises = _.chain(properties).map((prop, key) => {
      prop.setValue(userInputs[key]);
      return prop.validate(ctx).then((errors) => {
        if (!errors) return null;
        return [key, errors];
      });
    }).compact().value();

    return Promise.all(promises).then((results) => {
      return _.chain(results).compact().fromPairs().value();
    }).then((errors) => {
      if (_.isEmpty(errors)) {
        var filteredInputs = _.chain(properties).map((prop, name) => {
          return [name, prop.getValue()];
        }).fromPairs().value();
        ctx.args = filteredInputs;
        return filteredInputs;
      };
      return Promise.reject(errors);
    });
  }

  execute(args, ctx) {
    if (!this._enabled) {
      return Promise.reject(new Error(`API ${this.getName()} is disabled`));
    }

    ctx = ctx || {};

    if (!this._handler || !_.isFunction(this._handler)) {
      return Promise.reject(new Error(`API ${this.getName()} does not have a valid handler`));
    }

    return this._runHooks(this._beforeHooks, args, ctx).then(() => {
      return this._handler(args, ctx);
    }).then((result) => {
      ctx.result = result;
      return this._runHooks(this._afterHooks, args, ctx).then(() => {
        return result;
      });
    });
  }
}

module.exports = Route;
