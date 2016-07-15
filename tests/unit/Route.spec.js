/*eslint max-nested-callbacks:0*/

'use strict';
var Route = require('../../build/Route')
  , util = require('@naujs/util')
  , Promise = util.getPromise();

describe('Route', () => {
  var route, ctx;
  var args, handler;

  describe('#filterAndValidate', () => {
    beforeEach(() => {
      ctx = {};
      route = new Route('test', {
        args: {
          name: {
            type: 'string',
            required: true
          },
          address: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                required: true
              },
              city: {
                type: 'string',
                required: true
              }
            }
          }
        }
      });
    });

    it('should filter user inputs from args', () => {
      return route.filterAndValidate({
        name: 'Test',
        address: JSON.stringify({
          address: 'Test',
          city: 'Test'
        })
      }, ctx).then((filteredInputs) => {
        expect(ctx.args).toEqual({
          address: {
            address: 'Test',
            city: 'Test'
          },
          name: 'Test'
        });
        expect(ctx.args).toEqual(filteredInputs);
      });
    });

    it('should validate user inputs from args', () => {
      return route.filterAndValidate({
        name: 'Test',
        address: JSON.stringify({
          address: 'Test'
        })
      }).then(() => {
        fail('Should throw errors');
      }, (errors) => {
        expect(errors).toEqual({
          address: ['address.city is required']
        });
      });
    });
  });

  describe('#execute', () => {
    beforeEach(() => {
      args = {
        name: 1
      };

      ctx = {
        test: 2
      };

      handler = jasmine.createSpy('handler');
      route = new Route('test', {
        args: {
          name: 'number'
        },
        public: true
      }, handler);
    });

    it('should pass args and ctx to the handler', () => {
      return route.execute(args, ctx).then(() => {
        expect(handler).toHaveBeenCalledWith(args, ctx);
      });
    });

    it('should pass args and ctx to before hooks', () => {
      var before = jasmine.createSpy('before');
      route.before(before);

      return route.execute(args, ctx).then(() => {
        expect(before).toHaveBeenCalledWith(args, ctx);
      });
    });

    it('should pass result, args and ctx to after hooks', () => {
      var after = jasmine.createSpy('after');
      handler.and.returnValue(100);
      route.after(after);

      return route.execute(args, ctx).then(() => {
        ctx.result = 100;
        expect(after).toHaveBeenCalledWith(args, ctx);
      });
    });

    it('should stop when having a rejection', () => {
      route.before(() => {
        return Promise.reject('Error');
      });

      return route.execute(args, ctx).then(() => {
        fail('Should reject');
      }).catch((error) => {
        expect(error).toEqual('Error');
      });
    });

    it('should run hooks in correct order', () => {
      var check = [];

      route.before(() => {
        check.push(0);
      });

      route.before(() => {
        check.push(1);
      });

      route.before(() => {
        check.push(2);
      });

      route.after(() => {
        check.push(3);
      });

      route.after(() => {
        check.push(4);
      });

      return route.execute(args, ctx).then(() => {
        expect(check).toEqual([
          0,
          1,
          2,
          3,
          4
        ]);
      });
    });
  });

  describe('Access Control', () => {
    var deferred, authenticate;
    beforeEach(() => {
      deferred = util.defer();

      args = {
        name: 'test'
      };

      ctx = {
        test: 2
      };

      handler = jasmine.createSpy('handler');
      authenticate = jasmine.createSpy('authenticate');

      Route.role('authenticated', (args, ctx) => {
        return !!ctx.user;
      });

      Route.role('smod', (args, ctx) => {
        return ctx.role === 'smod';
      });

      Route.role('admin', (args, ctx) => {
        return ctx.role === 'admin';
      });

      Route.role('mod', (args, ctx) => {
        return ctx.role === 'mod';
      });

      Route.authenticate((args, ctx) => {
        authenticate(args, ctx);
        return deferred.promise;
      });
    });

    it('should not run the authenticate function when in public mode', () => {
      deferred.resolve({
        id: 1
      });

      route = new Route('test', {
        args: {
          name: 'string'
        },
        public: true,
        access: ['authenticated']
      }, handler);

      return route.execute(args, ctx).then(() => {
        expect(ctx.user === null).toBe(true);
        expect(authenticate).not.toHaveBeenCalled();
      });
    });

    it('should run the authenticate function', () => {
      deferred.resolve({
        id: 1
      });

      route = new Route('test', {
        args: {
          name: 'string'
        },
        access: ['authenticated']
      }, handler);

      return route.execute(args, ctx).then(() => {
        expect(authenticate.calls.count()).toEqual(1);
        expect(ctx.user).toEqual({
          id: 1
        });
      });
    });

    it('should reject if all roles are not met', () => {
      deferred.resolve({
        id: 1
      });

      route = new Route('test', {
        args: {
          name: 'string'
        },
        access: ['admin']
      }, handler);

      ctx.role = 'mod';

      return route.execute(args, ctx).then(fail, (error) => {
        expect(error.statusCode).toEqual(403);
      });
    });

    it('should allow if only one of the roles is met', () => {
      deferred.resolve({
        id: 1
      });

      route = new Route('test', {
        args: {
          name: 'string'
        },
        access: ['smod', 'mod']
      }, handler);

      ctx.role = 'mod';

      return route.execute(args, ctx).then(() => {

      }, fail);
    });

  });
});
