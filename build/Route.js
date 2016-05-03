'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var util = require('@naujs/util'),
    _ = require('lodash'),
    Promise = util.getPromise(),
    Property = require('@naujs/property');

var Route = (function () {
  function Route(name, definition, handler) {
    _classCallCheck(this, Route);

    this._name = name;
    this._definition = definition;
    this.setHandler(handler);

    this._beforeHooks = [];
    this._afterHooks = [];
    this.enable();
  }

  _createClass(Route, [{
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
    value: function getDefinition() {
      return this._definition;
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
      var _this = this;

      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      var fn = hooks.shift();
      if (!fn) {
        return Promise.resolve(null);
      }

      return util.tryPromise(fn.apply(undefined, args)).then(function () {
        return _this._runHooks.apply(_this, [hooks].concat(args));
      }).then(function () {
        return _this;
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
      var _this2 = this;

      if (!this._enabled) {
        return Promise.reject(new Error('API ' + this.getName() + ' is disabled'));
      }

      ctx = ctx || {};

      if (!this._handler || !_.isFunction(this._handler)) {
        return Promise.reject(new Error('API ' + this.getName() + ' does not have a valid handler'));
      }

      return this._runHooks(this._beforeHooks, args, ctx).then(function () {
        return _this2._handler(args, ctx);
      }).then(function (result) {
        ctx.result = result;
        return _this2._runHooks(_this2._afterHooks, args, ctx).then(function () {
          return result;
        });
      });
    }
  }]);

  return Route;
})();

module.exports = Route;