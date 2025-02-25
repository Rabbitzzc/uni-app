import { isPlainObject, hasOwn, extend, capitalize, isString } from 'uni-shared';

// 生成的 uts.js 需要同步到 vue2 src/platforms/app-plus/service/api/plugin
let callbackId = 1;
let proxy;
const callbacks = {};
function isUniElement(obj) {
    return typeof obj.getNodeId === 'function' && obj.pageId;
}
function isComponentPublicInstance(instance) {
    return instance && instance.$ && instance.$.proxy === instance;
}
function parseElement(obj) {
    if (isUniElement(obj)) {
        return obj;
    }
    else if (isComponentPublicInstance(obj)) {
        return obj.$el;
    }
}
function toRaw(observed) {
    const raw = observed && observed.__v_raw;
    return raw ? toRaw(raw) : observed;
}
function normalizeArg(arg) {
    arg = toRaw(arg);
    if (typeof arg === 'function') {
        // 查找该函数是否已缓存
        const oldId = Object.keys(callbacks).find((id) => callbacks[id] === arg);
        const id = oldId ? parseInt(oldId) : callbackId++;
        callbacks[id] = arg;
        return id;
    }
    else if (isPlainObject(arg)) {
        const el = parseElement(arg);
        if (el) {
            let nodeId = '';
            let pageId = '';
            // 非 x 可能不存在 getNodeId 方法？
            if (el && el.getNodeId) {
                pageId = el.pageId;
                nodeId = el.getNodeId();
            }
            return { pageId, nodeId };
        }
        else {
            Object.keys(arg).forEach((name) => {
                arg[name] = normalizeArg(arg[name]);
            });
        }
    }
    return arg;
}
function initUTSInstanceMethod(async, opts, instanceId, proxy) {
    return initProxyFunction('method', async, opts, instanceId, proxy);
}
function createInvokeAsyncBySync(invokeSync) {
    return function invokeAsync(args, callback) {
        const res = invokeSync(args, callback);
        callback(extend(res, {
            params: [res.params],
        }));
        return res;
    };
}
function getProxy() {
    if (!proxy) {
        {
            proxy = uni.requireNativePlugin('UTS-Proxy');
            if (isUTSiOS()) {
                // iOS 平台用sync模拟async
                proxy.invokeAsync = createInvokeAsyncBySync(proxy.invokeSync);
            }
        }
    }
    return proxy;
}
function resolveSyncResult(args, res, returnOptions, instanceId, proxy) {
    if ((process.env.NODE_ENV !== 'production')) {
        console.log('uts.invokeSync.result', JSON.stringify([res, returnOptions, instanceId, typeof proxy]));
    }
    if (!res) {
        throw new Error('返回值为：' +
            JSON.stringify(res) +
            '；请求参数为：' +
            JSON.stringify(args));
    }
    // devtools 环境是字符串？
    if (isString(res)) {
        try {
            res = JSON.parse(res);
        }
        catch (e) {
            throw new Error(`JSON.parse(${res}): ` + e);
        }
    }
    if (res.errMsg) {
        throw new Error(res.errMsg);
    }
    if (returnOptions) {
        if (returnOptions.type === 'interface' && typeof res.params === 'number') {
            // 返回了 0
            if (!res.params) {
                return null;
            }
            if (res.params === instanceId && proxy) {
                return proxy;
            }
            if (interfaceDefines[returnOptions.options]) {
                const ProxyClass = initUTSProxyClass(extend({ instanceId: res.params }, interfaceDefines[returnOptions.options]));
                return new ProxyClass();
            }
        }
    }
    return res.params;
}
function invokePropGetter(args) {
    if (args.errMsg) {
        throw new Error(args.errMsg);
    }
    delete args.errMsg;
    if ((process.env.NODE_ENV !== 'production')) {
        console.log('uts.invokePropGetter.args', args);
    }
    return resolveSyncResult(args, getProxy().invokeSync(args, () => { }));
}
function initProxyFunction(type, async, { moduleName, moduleType, package: pkg, class: cls, name: methodName, method, companion, params: methodParams, return: returnOptions, errMsg, }, instanceId, proxy) {
    const keepAlive = methodName.indexOf('on') === 0 &&
        methodParams.length === 1 &&
        methodParams[0].type === 'UTSCallback';
    const throws = async;
    const invokeCallback = ({ id, name, params }) => {
        const callback = callbacks[id];
        if (callback) {
            callback(...params);
            if (!keepAlive) {
                delete callbacks[id];
            }
        }
        else {
            console.error(`${pkg}${cls}.${methodName} ${name} is not found`);
        }
    };
    const baseArgs = instanceId
        ? {
            moduleName,
            moduleType,
            id: instanceId,
            type,
            name: methodName,
            method: methodParams,
            keepAlive,
            throws,
        }
        : {
            moduleName,
            moduleType,
            package: pkg,
            class: cls,
            name: method || methodName,
            type,
            companion,
            method: methodParams,
            keepAlive,
            throws,
        };
    return (...args) => {
        if (errMsg) {
            throw new Error(errMsg);
        }
        const invokeArgs = extend({}, baseArgs, {
            params: args.map((arg) => normalizeArg(arg)),
        });
        if (async) {
            return new Promise((resolve, reject) => {
                if ((process.env.NODE_ENV !== 'production')) {
                    console.log('uts.invokeAsync.args', invokeArgs);
                }
                getProxy().invokeAsync(invokeArgs, (res) => {
                    if ((process.env.NODE_ENV !== 'production')) {
                        console.log('uts.invokeAsync.result', res);
                    }
                    if (res.type !== 'return') {
                        invokeCallback(res);
                    }
                    else {
                        if (res.errMsg) {
                            reject(res.errMsg);
                        }
                        else {
                            resolve(res.params);
                        }
                    }
                });
            });
        }
        if ((process.env.NODE_ENV !== 'production')) {
            console.log('uts.invokeSync.args', invokeArgs);
        }
        return resolveSyncResult(invokeArgs, getProxy().invokeSync(invokeArgs, invokeCallback), returnOptions, instanceId, proxy);
    };
}
function initUTSStaticMethod(async, opts) {
    if (opts.main && !opts.method) {
        if (isUTSiOS()) {
            opts.method = 's_' + opts.name;
        }
    }
    return initProxyFunction('method', async, opts, 0);
}
const initUTSProxyFunction = initUTSStaticMethod;
function parseClassMethodName(name, methods) {
    if (typeof name === 'string' && hasOwn(methods, name + 'ByJs')) {
        return name + 'ByJs';
    }
    return name;
}
function isUndefined(value) {
    return typeof value === 'undefined';
}
function isProxyInterfaceOptions(options) {
    return !isUndefined(options.instanceId);
}
function parseClassPropertySetter(name) {
    return '__$set' + capitalize(name);
}
function initUTSProxyClass(options) {
    const { moduleName, moduleType, package: pkg, class: cls, methods, props, setters, errMsg, } = options;
    const baseOptions = {
        moduleName,
        moduleType,
        package: pkg,
        class: cls,
        errMsg,
    };
    let instanceId;
    let constructorParams = [];
    let staticMethods = {};
    let staticProps = [];
    let staticSetters = {};
    let isProxyInterface = false;
    if (isProxyInterfaceOptions(options)) {
        isProxyInterface = true;
        instanceId = options.instanceId;
    }
    else {
        constructorParams = options.constructor.params;
        staticMethods = options.staticMethods;
        staticProps = options.staticProps;
        staticSetters = options.staticSetters;
    }
    // iOS 需要为 ByJs 的 class 构造函数（如果包含JSONObject或UTSCallback类型）补充最后一个参数
    if (isUTSiOS()) {
        if (constructorParams.find((p) => p.type === 'UTSCallback' || p.type.indexOf('JSONObject') > 0)) {
            constructorParams.push({ name: '_byJs', type: 'boolean' });
        }
    }
    const ProxyClass = class UTSClass {
        constructor(...params) {
            this.__instanceId = 0;
            if (errMsg) {
                throw new Error(errMsg);
            }
            const target = {};
            // 初始化实例 ID
            if (!isProxyInterface) {
                // 初始化未指定时，每次都要创建instanceId
                this.__instanceId = initProxyFunction('constructor', false, extend({ name: 'constructor', params: constructorParams }, baseOptions), 0).apply(null, params);
            }
            else if (typeof instanceId === 'number') {
                this.__instanceId = instanceId;
            }
            if (!this.__instanceId) {
                throw new Error(`new ${cls} is failed`);
            }
            const instance = this;
            const proxy = new Proxy(instance, {
                get(_, name) {
                    // 重要：禁止响应式
                    if (name === '__v_skip') {
                        return true;
                    }
                    if (!target[name]) {
                        //实例方法
                        name = parseClassMethodName(name, methods);
                        if (hasOwn(methods, name)) {
                            const { async, params, return: returnOptions } = methods[name];
                            target[name] = initUTSInstanceMethod(!!async, extend({
                                name,
                                params,
                                return: returnOptions,
                            }, baseOptions), instance.__instanceId, proxy);
                        }
                        else if (props.includes(name)) {
                            // 实例属性
                            return invokePropGetter({
                                moduleName,
                                moduleType,
                                id: instance.__instanceId,
                                type: 'getter',
                                keepAlive: false,
                                throws: false,
                                name: name,
                                errMsg,
                            });
                        }
                    }
                    return target[name];
                },
                set(_, name, newValue) {
                    if (props.includes(name)) {
                        const setter = parseClassPropertySetter(name);
                        if (!target[setter]) {
                            const param = setters[name];
                            if (param) {
                                target[setter] = initProxyFunction('setter', false, extend({
                                    name: name,
                                    params: [param],
                                }, baseOptions), instance.__instanceId, proxy);
                            }
                        }
                        target[parseClassPropertySetter(name)](newValue);
                        return true;
                    }
                    return false;
                },
            });
            return proxy;
        }
    };
    const staticPropSetterCache = {};
    const staticMethodCache = {};
    return new Proxy(ProxyClass, {
        get(target, name, receiver) {
            name = parseClassMethodName(name, staticMethods);
            if (hasOwn(staticMethods, name)) {
                if (!staticMethodCache[name]) {
                    const { async, params, return: returnOptions } = staticMethods[name];
                    // 静态方法
                    staticMethodCache[name] = initUTSStaticMethod(!!async, extend({
                        name,
                        companion: true,
                        params,
                        return: returnOptions,
                    }, baseOptions));
                }
                return staticMethodCache[name];
            }
            if (staticProps.includes(name)) {
                return invokePropGetter(extend({
                    name: name,
                    companion: true,
                    type: 'getter',
                }, baseOptions));
            }
            return Reflect.get(target, name, receiver);
        },
        set(_, name, newValue) {
            if (staticProps.includes(name)) {
                // 静态属性
                const setter = parseClassPropertySetter(name);
                if (!staticPropSetterCache[setter]) {
                    const param = staticSetters[name];
                    if (param) {
                        staticPropSetterCache[setter] = initProxyFunction('setter', false, extend({
                            name: name,
                            params: [param],
                        }, baseOptions), 0);
                    }
                }
                staticPropSetterCache[parseClassPropertySetter(name)](newValue);
                return true;
            }
            return false;
        },
    });
}
function isUTSAndroid() {
    return typeof plus !== 'undefined' && plus.os.name === 'Android';
}
function isUTSiOS() {
    return !isUTSAndroid();
}
function initUTSPackageName(name, is_uni_modules) {
    if (isUTSAndroid()) {
        return 'uts.sdk.' + (is_uni_modules ? 'modules.' : '') + name;
    }
    return '';
}
function initUTSIndexClassName(moduleName, is_uni_modules) {
    return initUTSClassName(moduleName, isUTSAndroid() ? 'IndexKt' : 'IndexSwift', is_uni_modules);
}
function initUTSClassName(moduleName, className, is_uni_modules) {
    if (isUTSAndroid()) {
        return className;
    }
    return ('UTSSDK' +
        (is_uni_modules ? 'Modules' : '') +
        capitalize(moduleName) +
        capitalize(className));
}
const interfaceDefines = {};
function registerUTSInterface(name, define) {
    interfaceDefines[name] = define;
}
const pluginDefines = {};
function registerUTSPlugin(name, define) {
    pluginDefines[name] = define;
}
function requireUTSPlugin(name) {
    const define = pluginDefines[name];
    if (!define) {
        console.error(`${name} is not found`);
    }
    return define;
}

export { initUTSClassName, initUTSIndexClassName, initUTSPackageName, initUTSProxyClass, initUTSProxyFunction, normalizeArg, registerUTSInterface, registerUTSPlugin, requireUTSPlugin };
