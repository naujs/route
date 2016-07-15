'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var util = require('@naujs/util'),
    Component = require('@naujs/component'),
    _ = require('lodash'),
    Promise = util.getPromise(),
    Property = require('@naujs/property');

var Route = function (_Component) {
  _inherits(Route, _Component);

  function Route(name, definition, handler) {
    _classCallCheck(this, Route);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Route).call(this));

    _this._name = name;
    _this._definition = definition;
    _this.setHandler(handler);

    _this._beforeHooks = [];
    _this._afterHooks = [];
    _this.enable();
    return _this;
  }

  _createClass(Route, [{
    key: 'authenticateRequest',
    value: function authenticateRequest(args, ctx) {
      var auth = this.getClass()._autenticate;
      if (!auth) return Promise.resolve(null);
      return util.tryPromise(auth(args, ctx));
    }
  }, {
    key: '_executeRole',
    value: function _executeRole(access, args, ctx) {
      var _this2 = this;

      access = access.slice();
      var role = access.shift();

      if (!role) return Promise.resolve(false);

      var roles = this.getClass()._roles || {};
      var fn = roles[role];
      if (!fn) return Promise.resolve(false);

      return util.tryPromise(fn(args, ctx)).then(function (result) {
        if (result) return true;
        return _this2._executeRole(access, args, ctx);
      });
    }
  }, {
    key: 'authorizeRequest',
    value: function authorizeRequest(args, ctx) {
      var access = this.getDefinition('access');
      var error = new Error();
      error.code = error.statusCode = 403;
      error.message = 'Unauthorized access';

      if (this.getDefinition('public') === true) return Promise.resolve([]);
      if (!access || !access.length) return Promise.reject(error);

      return this._executeRole(access, args, ctx).then(function (result) {
        if (!result) return Promise.reject(error);
        return true;
      });
    }
  }, {
    key: 'getPath',
    value: function getPath() {
      return this._definition.path;
    }
  }, {
    key: 'getArgs',
    value: function getArgs() {
      if (!this._args) {
        var args = {};
        _.each(this._definition.args, function (options, name) {
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
  }, {
    key: 'getMethod',
    value: function getMethod() {
      return this._definition.method || this._definition.type || 'get';
    }
  }, {
    key: 'isEnabled',
    value: function isEnabled() {
      return this._enabled;
    }
  }, {
    key: 'disable',
    value: function disable() {
      this._enabled = false;
    }
  }, {
    key: 'enable',
    value: function enable() {
      this._enabled = true;
    }
  }, {
    key: 'getName',
    value: function getName() {
      return this._name;
    }
  }, {
    key: 'setHandler',
    value: function setHandler(fn) {
      this._handler = fn;
    }
  }, {
    key: 'getHandler',
    value: function getHandler() {
      return this._handler;
    }
  }, {
    key: 'setDefinition',
    value: function setDefinition(definition) {
      this._definition = definition;
      delete this._args;
    }
  }, {
    key: 'getDefinition',
    value: function getDefinition(key) {
      if (!key) return this._definition;
      return (this._definition || {})[key];
    }
  }, {
    key: 'setModelClass',
    value: function setModelClass(cls) {
      this._modelClass = cls;
    }
  }, {
    key: 'getModelClass',
    value: function getModelClass() {
      return this._modelClass;
    }
  }, {
    key: 'before',
    value: function before(fn) {
      this._beforeHooks.push(fn);
    }
  }, {
    key: 'after',
    value: function after(fn) {
      this._afterHooks.push(fn);
    }
  }, {
    key: '_runHooks',
    value: function _runHooks(hooks) {
      var _this3 = this;

      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      var fn = hooks.shift();
      if (!fn) {
        return Promise.resolve(null);
      }

      return util.tryPromise(fn.apply(undefined, args)).then(function () {
        return _this3._runHooks.apply(_this3, [hooks].concat(args));
      }).then(function () {
        return _this3;
      });
    }
  }, {
    key: 'filterAndValidate',
    value: function filterAndValidate(userInputs, ctx) {
      ctx = ctx || {};
      var properties = Property.parse(this.getArgs());
      var filterUserInputs = {};

      var promises = _.chain(properties).map(function (prop, key) {
        prop.setValue(userInputs[key]);
        return prop.validate(ctx).then(function (errors) {
          if (!errors) return null;
          return [key, errors];
        });
      }).compact().value();

      return Promise.all(promises).then(function (results) {
        return _.chain(results).compact().fromPairs().value();
      }).then(function (errors) {
        if (_.isEmpty(errors)) {
          var filteredInputs = _.chain(properties).map(function (prop, name) {
            return [name, prop.getValue()];
          }).fromPairs().value();
          ctx.args = filteredInputs;
          return filteredInputs;
        };
        return Promise.reject(errors);
      });
    }
  }, {
    key: 'execute',
    value: function execute(args, ctx) {
      var _this4 = this;

      if (!this._enabled) {
        return Promise.reject(new Error(this.getName() + ' is disabled'));
      }

      ctx = ctx || {};

      var handler = this.getHandler() || ctx.fallbackHandler;

      if (!handler || !_.isFunction(handler)) {
        return Promise.reject(new Error(this.getName() + ' does not have a valid handler'));
      }

      var authPromise;
      if (this.getDefinition('public') === true) {
        authPromise = Promise.resolve(null);
      } else {
        authPromise = this.authenticateRequest(args, ctx);
      }

      return authPromise.then(function (user) {
        ctx.user = user;
        return _this4.authorizeRequest(args, ctx);
      }).then(function () {
        return _this4._runHooks(_this4._beforeHooks, args, ctx);
      }).then(function () {
        return _this4.filterAndValidate(args, ctx);
      }).then(function (filteredInputs) {
        return handler(filteredInputs, ctx);
      }).then(function (result) {
        ctx.result = result;
        return _this4._runHooks(_this4._afterHooks, args, ctx).then(function () {
          return result;
        });
      });
    }
  }], [{
    key: 'authenticate',
    value: function authenticate(fn) {
      this._autenticate = fn;
    }
  }, {
    key: 'role',
    value: function role(name, fn) {
      this._roles = this._roles || {};
      this._roles[name] = fn;
    }
  }]);

  return Route;
}(Component);

module.exports = Route;