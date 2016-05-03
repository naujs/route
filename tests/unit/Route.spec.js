/*eslint max-nested-callbacks:0*/

'use strict';
var Route = require('../../build/Route')
  , Promise = require('@naujs/util').getPromise();

describe('Route', () => {
  var route, ctx;

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
    var args, handler;

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
        }
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
});
