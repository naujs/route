var util = require('@naujs/util')
  , Component = require('@naujs/component')
  , _ = require('lodash')
  , Promise = util.getPromise()
  , Property = require('@naujs/property');

class Route extends Component {
  constructor(name, definition, handler) {
    super();
    this._name = name;
    this._definition = definition;
    this.setHandler(handler);

    this._beforeHooks = [];
    this._afterHooks = [];
    this.enable();
  }

  static authenticate(fn) {
    this._autenticate = fn;
  }

  authenticateRequest(args, ctx) {
    var auth = this.getClass()._autenticate;
    if (!auth) return Promise.resolve(null);
    return util.tryPromise(auth(args, ctx));
  }

  static role(name, fn) {
    this._roles = this._roles || {};
    this._roles[name] = fn;
  }

  _executeRole(access, args, ctx) {
    access = access.slice();
    var role = access.shift();

    if (!role) return Promise.resolve(false);

    var roles = this.getClass()._roles || {};
    var fn = roles[role];
    if (!fn) return Promise.resolve(false);

    return util.tryPromise(fn(args, ctx)).then((result) => {
      if (result) return true;
      return this._executeRole(access, args, ctx);
    });
  }

  authorizeRequest(args, ctx) {
    var access = this.getDefinition('access');
    var error = new Error();
    error.code = error.statusCode = 403;
    error.message = 'Unauthorized access';

    if (this.getDefinition('public') === true) return Promise.resolve([]);
    if (!access || !access.length) return Promise.reject(error);

    return this._executeRole(access, args, ctx).then((result) => {
      if (!result) return Promise.reject(error);
      return true;
    });
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

  getDefinition(key) {
    if (!key) return this._definition;
    return (this._definition || {})[key];
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
      return Promise.reject(new Error(`${this.getName()} is disabled`));
    }

    ctx = ctx || {};
    var Model = this.getModelClass();
    var handler = this.getHandler();

    if (!handler && Model) {
      handler = Model[this.getName()];
    }

    if (!handler || !_.isFunction(handler)) {
      return Promise.reject(new Error(`${this.getName()} does not have a valid handler`));
    }

    var authPromise;
    if (this.getDefinition('public') === true) {
      authPromise = Promise.resolve(null);
    } else {
      authPromise = this.authenticateRequest(args, ctx);
    }

    return authPromise.then((user) => {
      ctx.user = user;
      return this.authorizeRequest(args, ctx);
    }).then(() => {
      return this._runHooks(this._beforeHooks, args, ctx);
    }).then(() => {
      return this.filterAndValidate(args, ctx);
    }).then((filteredInputs) => {
      if (Model) return handler.call(Model, filteredInputs, ctx);
      return handler(filteredInputs, ctx);
    }).then((result) => {
      ctx.result = result;
      return this._runHooks(this._afterHooks, args, ctx).then(() => {
        return result;
      });
    });
  }
}

module.exports = Route;
