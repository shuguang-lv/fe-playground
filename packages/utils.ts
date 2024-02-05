/**
 * An asynchronous function for streaming the body of a Response object
 * obtained from a fetch() request. Pass the Response object as the first
 * argument followed by two optional callbacks.
 *
 * If you specify a function as the second argument, that reportProgress
 * callback will be called once for each chunk that is received. The first
 * argument passed is the total number of bytes received so far. The second
 * argument is a number between 0 and 1 specifying how complete the download
 * is. If the Response object has no "Content-Length" header, however, then
 * this second argument will always be NaN.
 *
 * If you want to process the data in chunks as they arrive, specify a
 * function as the third argument. The chunks will be passed, as Uint8Array
 * objects, to this processChunk callback.
 *
 * streamBody() returns a Promise that resolves to a string. If a processChunk
 * callback was supplied then this string is the concatenation of the values
 * returned by that callback. Otherwise the string is the concatenation of
 * the chunk values converted to UTF-8 strings.
 */
export async function streamBody(response: Response, reportProgress?: (bytesRead: number, progress: number) => void, progressChunk?: (chunk: Uint8Array) => string): Promise<string> {
  const expectedBytes = parseInt(response.headers.get('Content-Length') || '0')
  let bytesRead = 0
  const reader = response.body!.getReader()
  const decoder = new TextDecoder('utf-8')
  let body = ''

  while (true) {
    const { done, value } = await reader.read()

    if (value) {
      if (progressChunk) {
        const processed = progressChunk(value)
        if (processed) body += processed
      } else {
        body += decoder.decode(value, { stream: true })
      }

      if (reportProgress) {
        bytesRead += value.length
        reportProgress(bytesRead, bytesRead / expectedBytes)
      }
    }

    if (done) break
  }

  return body
}

// Asynchronously load and execute a script from a specified URL
// Returns a Promise that resolves when the script has loaded.
export function importScript(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.onload = () => resolve('loaded') // Indicate that the script is loaded successfully
    script.onerror = (e) => reject(e)
    script.src = url
    document.head.append(script)
  })
}

// This function is like fetch(), but it adds support for a timeout
// property in the options object and aborts the fetch if it is not complete
// within the number of milliseconds specified by that property.
export function fetchWithTimeout(url: string, options: { timeout?: number; signal?: AbortSignal } = {}): Promise<Response> {
  if (options.timeout) {
    const controller = new AbortController()
    options.signal = controller.signal
    setTimeout(() => controller.abort(), options.timeout)
  }

  return fetch(url, options)
}

/*
 * Define a new Object.assignDescriptors() function that works like
 * Object.assign() except that it copies property descriptors from
 * source objects into the target object instead of just copying
 * property values. This function copies all own properties, both
 * enumerable and non-enumerable. And because it copies descriptors,
 * it copies getter functions from source objects and overwrites setter
 * functions in the target object rather than invoking those getters and
 * setters.
 *
 * Object.assignDescriptors() propagates any TypeErrors thrown by
 * Object.defineProperty(). This can occur if the target object is sealed
 * or frozen or if any of the source properties try to change an existing
 * non-configurable property on the target object.
 *
 * Note that the assignDescriptors property is added to Object with
 * Object.defineProperty() so that the new function can be created as
 * a non-enumerable property like Object.assign().
 */
export function useAssignDescriptors() {
  const overwriteDescriptor = (target: any, source: any, name: string | symbol): void => {
    const desc = Object.getOwnPropertyDescriptor(source, name) || {}
    Object.defineProperty(target, name, desc)
  }

  Object.defineProperty(Object, 'assignDescriptors', {
    writable: true,
    enumerable: true,
    configurable: true,
    value: function (target: any, ...sources: any[]): any {
      for (const source of sources) {
        for (const name of Object.getOwnPropertyNames(source)) {
          overwriteDescriptor(target, source, name)
        }
        for (const symbol of Object.getOwnPropertySymbols(source)) {
          overwriteDescriptor(target, source, symbol)
        }
      }
      return target
    },
  })
}

// This function takes an array of input values and a "promiseMaker" function.
// For any input value x in the array, promiseMaker(x) should return a Promise
// that will fulfill to an output value. This function returns a Promise
// that fulfills to an array of the computed output values.
//
// Rather than creating the Promises all at once and letting them run in
// parallel, however, promiseSequence() only runs one Promise at a time
// and does not call promiseMaker() for a value until the previous Promise
// has fulfilled.
export async function promiseSequence<T, U>(inputs: T[] = [], promiseMaker: (input: T | undefined) => Promise<U> = (input) => Promise.resolve(input as U)): Promise<U[]> {
  const remainingInputs = [...inputs]

  function handleNextInput(outputs: U[] = []): Promise<U[]> {
    if (remainingInputs.length === 0) {
      return Promise.resolve(outputs)
    } else {
      const nextInput = remainingInputs.shift()
      return promiseMaker(nextInput)
        .then((output) => outputs.concat(output))
        .then(handleNextInput)
    }
  }

  return Promise.resolve([]).then(handleNextInput)
}

export function clock(interval: number, max: number = Infinity) {
  function until(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time - Date.now()))
  }

  const startTime = Date.now()
  let count = 0

  return {
    async next() {
      if (++count > max) return { done: true }
      const targetTime = startTime + count * interval
      await until(targetTime)
      return { value: count }
    },
    [Symbol.asyncIterator]() {
      return this
    },
  }
}

/**
 * An asynchronously iterable queue class. Add values with enqueue()
 * and remove them with dequeue(). dequeue() returns a Promise, which
 * means that values can be dequeued before they are enqueued. The
 * class implements [Symbol.asyncIterator] and next() so that it can
 * be used with the for/await loop (which will not terminate until
 * the close() method is called.)
 */
// // Push events of the specified type on the specified document element
// // onto an AsyncQueue object, and return the queue for use as an event stream
// function eventStream(elt, type) {
//   const q = new AsyncQueue();                  // Create a queue
//   elt.addEventListener(type, e=>q.enqueue(e)); // Enqueue events
//   return q;
// }
// async function handleKeys() {
//   // Get a stream of keypress events and loop once for each one
//   for await (const event of eventStream(document, "keypress")) {
//       console.log(event.key);
//   }
// }
export class AsyncQueue<T> implements AsyncIterable<T> {
  private values: T[] = []
  private resolvers: ((value: T | symbol | PromiseLike<T | symbol>) => void)[] = []
  private closed = false
  static EOS = Symbol('end-of-stream')

  enqueue(value: T): void {
    if (this.closed) {
      throw new Error('AsyncQueue closed')
    }
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()
      resolve && resolve(value)
    } else {
      this.values.push(value)
    }
  }

  dequeue(): Promise<T | symbol> {
    if (this.values.length > 0) {
      const value = this.values.shift()
      return Promise.resolve(value!)
    } else if (this.closed) {
      return Promise.resolve(AsyncQueue.EOS)
    } else {
      return new Promise((resolve) => this.resolvers.push(resolve))
    }
  }

  close(): void {
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()
      resolve && resolve(AsyncQueue.EOS)
    }
    this.closed = true
  }

  [Symbol.asyncIterator](): AsyncIterator<T | any> {
    return this
  }

  next(): Promise<IteratorResult<T | symbol>> {
    return this.dequeue().then((value) => (value === AsyncQueue.EOS ? { value: undefined as any, done: true } : { value, done: false }))
  }

  return(): Promise<IteratorResult<T>> {
    this.close()
    return Promise.resolve({ value: undefined as any, done: true })
  }
}

export function partialLeft<T>(f: (...args: T[]) => T, ...outerArgs: T[]) {
  return function (...innerArgs: T[]) {
    const args = [...outerArgs, ...innerArgs]
    return f.apply(this, args)
  }
}

export function partialRight<T>(f: (...args: T[]) => T, ...outerArgs: T[]) {
  return function (...innerArgs: T[]) {
    const args = [...innerArgs, ...outerArgs]
    return f.apply(this, args)
  }
}

export function partial<T>(f: (...args: T[]) => T, ...outerArgs: T[]) {
  return function (...innerArgs: T[]) {
    const args = [...outerArgs]
    let innerIndex = 0
    for (let i = 0; i < args.length; i++) {
      if (args[i] === undefined) args[i] = innerArgs[innerIndex++]
    }
    args.push(...innerArgs.slice(innerIndex))
    return f.apply(this, args)
  }
}

type F = () => Promise<any>

export async function promisePool(functions: F[], n: number) {
  async function evaluateNext() {
    if (functions.length === 0) return
    const fn = functions.shift()
    fn && (await fn())
    await evaluateNext()
  }
  const nPromises = Array(n).fill(0).map(evaluateNext)
  return await Promise.all(nPromises)
}

// Invokes the provided callback on each animation frame.
// const cb = () => console.log('Animation frame fired');
// const recorder = recordAnimationFrames(cb);
// // logs 'Animation frame fired' on each animation frame
// recorder.stop(); // stops logging
// recorder.start(); // starts again
// const recorder2 = recordAnimationFrames(cb, false);
// // `start` needs to be explicitly called to begin recording frames
export function recordAnimationFrames(callback: () => void, autoStart = true): { start: () => void; stop: () => void } {
  let running = false
  let raf: number

  const stop = (): void => {
    if (!running) return
    running = false
    cancelAnimationFrame(raf)
  }

  const start = (): void => {
    if (running) return
    running = true
    run()
  }

  const run = (): void => {
    raf = requestAnimationFrame(() => {
      callback()
      if (running) run()
    })
  }

  if (autoStart) start()

  return { start, stop }
}

// Creates a debounced function that returns a promise,
// but delays invoking the provided function until at least
// ms milliseconds have elapsed since the last time it was invoked.
// All promises returned during this time will return the same data.
export const debouncePromise = <T>(fn: (...args: any[]) => Promise<T>, ms = 0) => {
  let timeoutId: number
  const pending: Array<{ resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: any) => void }> = []

  return (...args: any[]): Promise<T> =>
    new Promise((resolve, reject) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        const currentPending = [...pending]
        pending.length = 0
        Promise.resolve(fn.apply(this, args)).then(
          (data: T) => {
            currentPending.forEach(({ resolve }) => resolve(data))
          },
          (error: any) => {
            currentPending.forEach(({ reject }) => reject(error))
          }
        )
      }, ms)
      pending.push({ resolve, reject })
    })
}

// Gets the target value in a nested JSON object, based on the given key.
// const data = {
//   level1: {
//     level2: {
//       level3: 'some data'
//     }
//   }
// };
// dig(data, 'level3'); // 'some data'
// dig(data, 'level4'); // undefined
export const dig = (obj: any, target: string | number) =>
  target in obj
    ? obj[target]
    : Object.values(obj).reduce((acc, val) => {
        if (acc !== undefined) return acc
        if (typeof val === 'object') return dig(val, target)
      }, undefined)

// add a timeout to a promise
// const myFunc = async () => {
//   const timeout = new Timeout();
//   const timeout2 = new Timeout();
//   timeout.set(6000).then(() => console.log('Hello'));
//   timeout2.set(4000).then(() => console.log('Hi'));
//   timeout
//     .wrap(fetch('https://cool.api.io/data.json'), 3000, {
//       reason: 'Fetch timeout',
//     })
//     .then(data => {
//       console.log(data.message);
//     })
//     .catch(data => console.log(`Failed with reason: ${data.reason}`))
//     .finally(() => timeout.clear(...timeout.ids));
export class Timeout {
  private ids: number[] = []

  set(delay, reason) {
    return new Promise((resolve, reject) => {
      const id = setTimeout(() => {
        if (reason === undefined) resolve('')
        else reject(reason)
        this.clear(id)
      }, delay)
      this.ids.push(id)
    })
  }

  wrap(promise, delay, reason) {
    return Promise.race([promise, this.set(delay, reason)])
  }

  clear(...ids) {
    this.ids = this.ids.filter((id) => {
      if (ids.includes(id)) {
        clearTimeout(id)
        return false
      }
      return true
    })
  }
}

type Fn = (...params: any[]) => Promise<any>

export function timeLimit1(fn: Fn, t: number): Fn {
  return async function (...args) {
    const timeLimitPromise = new Promise((resolve, reject) => {
      setTimeout(() => reject('Time Limit Exceeded'), t)
    })
    const returnPromise = fn(...args)
    return Promise.race([timeLimitPromise, returnPromise])
  }
}

export function timeLimit2(fn: Fn, t: number): Fn {
  return async function (...args) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject('Time Limit Exceeded')
      }, t)
      try {
        const result = await fn(...args)
        resolve(result)
      } catch (error) {
        reject(error)
      }
      clearTimeout(timeout)
    })
  }
}

// const obj = {
//   foo: '1',
//   nested: {
//     child: {
//       withArray: [
//         {
//           grandChild: ['hello']
//         }
//       ]
//     }
//   }
// };
// const upperKeysObj = deepMapKeys(obj, key => key.toUpperCase());
// /*
// {
//   "FOO":"1",
//   "NESTED":{
//     "CHILD":{
//       "WITHARRAY":[
//         {
//           "GRANDCHILD":[ 'hello' ]
//         }
//       ]
//     }
//   }
// }
// */
export const deepMapKeys = (obj, fn) =>
  Array.isArray(obj)
    ? obj.map((val) => deepMapKeys(val, fn))
    : typeof obj === 'object'
    ? Object.keys(obj).reduce((acc, cur) => {
        const key = fn(cur)
        const val = obj[cur]
        acc[key] = val !== null && typeof val === 'object' ? deepMapKeys(val, fn) : val
        return acc
      }, {})
    : obj

// Runs a function in a separate thread by using a Web Worker,
// allowing long running functions to not block the UI.
// const longRunningFunction = () => {
//   let result = 0;
//   for (let i = 0; i < 1000; i++)
//     for (let j = 0; j < 700; j++)
//       for (let k = 0; k < 300; k++) result = result + i + j + k;
//   return result;
// };
// /*
//   NOTE: Since the function is running in a different context, closures are not supported.
//   The function supplied to `runAsync` gets stringified, so everything becomes literal.
//   All variables and functions must be defined inside.
// */
// runAsync(longRunningFunction).then(console.log); // 209685000000
// runAsync(() => 10 ** 3).then(console.log); // 1000
// let outsideVariable = 50;
// runAsync(() => typeof outsideVariable).then(console.log); // 'undefined'
export const runAsync = (fn) => {
  const worker = new Worker(
    URL.createObjectURL(
      new Blob([`postMessage((${fn})());`], {
        type: 'application/javascript; charset=utf-8',
      })
    )
  )
  return new Promise((res, rej) => {
    worker.onmessage = ({ data }) => {
      res(data)
      worker.terminate()
    }
    worker.onerror = (err) => {
      rej(err)
      worker.terminate()
    }
  })
}

// Parses an HTTP Cookie header string, returning an object of all cookie name-value pairs.
export const parseCookie = (str: string) =>
  str
    .split(';')
    .map((v) => v.split('='))
    .reduce((acc, v) => {
      acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim())
      return acc
    }, {})

// caches the result once called, so when same arguments are passed in, the result will be returned right away
export function memo(func, resolver = (...args) => args.join('_')) {
  const cache = new Map()
  return function (...args) {
    const cacheKey = resolver(...args)
    if (cache.has(cacheKey)) return cache.get(cacheKey)
    const value = func.apply(this, args)
    cache.set(cacheKey, value)
    return value
  }
}

export function fold(fn: (...args: any[]) => any) {
  return function (...args: any[]) {
    const lastArg = args[args.length - 1]
    if (Array.isArray(lastArg)) {
      return fn.call(this, ...args.slice(0, -1), ...lastArg)
    }
    return fn.call(this, ...args)
  }
}

export function pipe(...fns) {
  return function (input) {
    return fns.reduce((a, b) => {
      return b.call(this, a)
    }, input)
  }
}

export function intercept(fn, { beforeCall = () => {}, afterCall = () => {} }) {
  return function (...args) {
    if (!beforeCall || beforeCall.call(this, args) !== true) {
      const ret = fn.apply(this, args)
      if (afterCall) return afterCall.call(this, ret)
      return ret
    }
  }
}

export function once(fn, replacer = () => {}) {
  return function (...args) {
    if (fn) {
      const ret = fn.apply(this, args)
      fn = null
      return ret
    }
    if (replacer) {
      return replacer.apply(this, args)
    }
  }
}

class PreloadImage {
  private imgNode: HTMLImageElement
  constructor(imgNode) {
    this.imgNode = imgNode
  }
  setSrc(imgUrl) {
    this.imgNode.src = imgUrl
  }
}

// 图片预加载 (虚拟代理)
export class ProxyImage {
  static LOADING_URL = 'xxx'
  private targetImage: PreloadImage
  constructor(targetImage) {
    this.targetImage = targetImage
  }
  setSrc(targetUrl) {
    this.targetImage.setSrc(ProxyImage.LOADING_URL)
    const virtualImage = new Image()
    virtualImage.onload = () => {
      this.targetImage.setSrc(targetUrl)
    }
    virtualImage.src = targetUrl
  }
}

// 图片懒加载
export const lazyLoadImages = () => {
  const lazyImages: HTMLImageElement[] = [].slice.call(document.querySelectorAll('img.lazy'))

  if ('IntersectionObserver' in window) {
    const lazyImageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const lazyImage = entry.target as HTMLImageElement
          lazyImage.src = lazyImage.dataset.src || ''
          lazyImage.srcset = lazyImage.dataset.srcset || ''
          lazyImage.classList.remove('lazy')
          lazyImageObserver.unobserve(lazyImage)
        }
      })
    })

    lazyImages.forEach((lazyImage) => {
      lazyImageObserver.observe(lazyImage)
    })
  } else {
    // Possibly fall back to event handlers here
  }
}

// const list = new LRUCache(4)
// list.put(2,2)   // 入 2，剩余容量3
// list.put(3,3)   // 入 3，剩余容量2
// list.put(4,4)   // 入 4，剩余容量1
// list.put(5,5)   // 入 5，已满    从头至尾         2-3-4-5
// list.put(4,4)   // 入4，已存在 ——> 置队尾         2-3-5-4
// list.put(1,1)   // 入1，不存在 ——> 删除队首 插入1  3-5-4-1
// list.get(3)     // 获取3，刷新3——> 置队尾         5-4-1-3
// list.toString()
export class LRUCache {
  capacity: number
  cache: Map<number, number | null>

  constructor(capacity: number) {
    this.capacity = capacity
    this.cache = new Map()
  }

  get(key: number): number {
    if (this.cache.has(key)) {
      const temp = this.cache.get(key) as number
      this.cache.delete(key)
      this.cache.set(key, temp)
      return temp
    }
    return -1
  }

  put(key: number, value: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
      console.log(`refresh: key:${key} , value:${value}`)
    }
    this.cache.set(key, value)
  }

  [Symbol.toStringTag]() {
    console.log('capacity', this.capacity)
    console.table([...this.cache])
  }
}

export const singletonify = <T extends new (...args: any[]) => any>(className: T): T => {
  let instance: InstanceType<T> | null = null
  return new Proxy(className, {
    // @ts-ignore
    construct: (target, argumentsList) => {
      if (!instance) {
        instance = new target(...argumentsList)
      }
      return instance
    },
  })
}

export class Storage {
  private static instance: Storage | null = null
  static getInstance() {
    if (!Storage.instance) Storage.instance = new Storage()
    return Storage.instance
  }
  getItem(key) {
    return localStorage.getItem(key)
  }
  setItem(key, value) {
    return localStorage.setItem(key, value)
  }
}

// class Person {
//   @autobind
//   getPerson() {
//     return this;
//   }
// }
// let person = new Person();
// let { getPerson } = person;
// getPerson() === person;
// // true

const { defineProperty, getPrototypeOf } = Object

function bind(fn: Function, context: any) {
  if (fn.bind) {
    return fn.bind(context)
  } else {
    return function __autobind__() {
      return fn.apply(context, arguments)
    }
  }
}

function createDefaultSetter(key: string) {
  return function set(newValue: any) {
    defineProperty(this, key, {
      configurable: true,
      writable: true,
      enumerable: true,
      value: newValue,
    })
    return newValue
  }
}

export function autobind(target: any, key: string, descriptor: PropertyDescriptor) {
  if (typeof descriptor.value !== 'function') {
    throw new SyntaxError(`@autobind can only be used on functions, not: ${descriptor.value}`)
  }
  const { constructor } = target
  return {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get() {
      if (this === target) return descriptor.value
      const boundFn = bind(descriptor.value, this)
      defineProperty(this, key, {
        configurable: true,
        writable: true,
        enumerable: false,
        value: boundFn,
      })
      return boundFn
    },
    set: createDefaultSetter(key),
  }
}

// 异步并发数限制
// 1. `new Promise` 一旦创建，立即执行
// 2. 使用 `Promise.resolve().then()` 可以把任务加到微任务队列中，防止立即执行迭代方法
// 3. 微任务处理过程中，产生的新的微任务，会在同一事件循环内，追加到微任务队列里
// 4. 使用 `race` 在某个任务完成时，继续添加任务，保持任务按照最大并发数进行执行
// 5. 任务完成后，需要从 `doningTasks` 中移出
// const timeout = i => new Promise(resolve => setTimeout(() => resolve(i), i));
// limit(2, [1000, 1000, 1000, 1000], timeout).then(res => console.log(res));
export function limit<T>(count: number, arr: T[], iterateFunc: (item: T) => Promise<any>): Promise<any[]> {
  const tasks: Promise<any>[] = []
  const doingTasks: Promise<void>[] = []
  let i = 0

  const enqueue = (): Promise<void> => {
    if (i === arr.length) return Promise.resolve()
    const task = Promise.resolve().then(() => iterateFunc(arr[i++]))
    tasks.push(task)
    const doing = task.then(() => {
      const index = doingTasks.indexOf(doing)
      if (index !== -1) doingTasks.splice(index, 1)
    })
    doingTasks.push(doing)
    const res = doingTasks.length >= count ? Promise.race(doingTasks) : Promise.resolve()
    return res.then(enqueue)
  }

  return enqueue().then(() => Promise.all(tasks))
}

// 将输入字符串转化为特定的结构化数据
// 字符串仅由小写字母和[]组成，且字符串不会包含多余的空格
// 'a, b, c' => {value: 'abc'}
// '[abc[bcd[def]]]' => {value: 'abc', children: {value: 'bcd', children: {value: 'def'}}}
export function normalize(str: string) {
  const result: any = {}
  str
    .split(/[\[\]]/g)
    .filter(Boolean)
    .reduce((obj, item, index, arr) => {
      obj.value = item
      if (index !== arr.length - 1) return (obj.children = {})
    }, result)
  return result
}

// unflattenObject({ 'a.b.c': 1, d: 1 }); // { a: { b: { c: 1 } }, d: 1 }
// unflattenObject({ 'a.b': 1, 'a.c': 2, d: 3 }); // { a: { b: 1, c: 2 }, d: 3 }
// unflattenObject({ 'a.b.0': 8, d: 3 }); // { a: { b: [ 8 ] }, d: 3 }
export const unflattenObject = (obj) =>
  Object.keys(obj).reduce((res, k) => {
    k.split('.').reduce((acc, e, i, keys) => acc[e] || (acc[e] = isNaN(Number(keys[i + 1])) ? (keys.length - 1 === i ? obj[k] : {}) : []), res)
    return res
  }, {})

// flattenObject({ a: { b: { c: 1 } }, d: 1 }); // { 'a.b.c': 1, d: 1 }
export const flattenObject = (obj, prefix = '') =>
  Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? `${prefix}.` : ''
    if (typeof obj[k] === 'object' && obj[k] !== null && Object.keys(obj[k]).length > 0) {
      Object.assign(acc, flattenObject(obj[k], pre + k))
    } else {
      acc[pre + k] = obj[k]
    }
    return acc
  }, {})

// const comments = [
//   { id: 1, parent_id: null },
//   { id: 2, parent_id: 1 },
//   { id: 3, parent_id: 1 },
//   { id: 4, parent_id: 2 },
//   { id: 5, parent_id: 4 }
// ];
// const nestedComments = nest(comments);
// // [{ id: 1, parent_id: null, children: [...] }]
export const nest = (items, id = null, link = 'parent_id') => items.filter((item) => item[link] === id).map((item) => ({ ...item, children: nest(items, item.id, link) }))

// add(1) => 1
// add(1, 2) => 3
// add(1)(2)(3) => 6
// add(1)(2, 3) => 6
// add(1, 2)(3) => 6
// add(1, 2, 3) => 6
export function add(...args: number[]): any {
  const fn = function (...fn_args: number[]) {
    return add(...args.concat(fn_args))
  }

  fn.toString = function () {
    return args.reduce((a, b) => a + b, 0)
  }

  return fn
}

// 对于运算类操作，如 +-*/，就不能使用 toPrecision 了。正确的做法是把小数转成整数后再运算
export function addEnhanced(num1: number, num2: number): number {
  const num1Digits = (num1.toString().split('.')[1] || '').length
  const num2Digits = (num2.toString().split('.')[1] || '').length
  const baseNum = Math.pow(10, Math.max(num1Digits, num2Digits))
  return (baseNum * num1 + baseNum * num2) / baseNum
}

// 输入描述：
// namespace({a: {test: 1, b: 2}}, 'a.b.c.d')
// 输出描述：
// {a: {test: 1, b: {c: {d: {}}}}}
export function namespace(oNamespace, sPackage) {
  const arr = sPackage.split('.')
  const res = oNamespace

  for (let i = 0, len = arr.length; i < len; i++) {
    if (arr[i] in oNamespace) {
      if (typeof oNamespace[arr[i]] !== 'object') {
        oNamespace[arr[i]] = {}
      }
    } else {
      oNamespace[arr[i]] = {}
    }

    oNamespace = oNamespace[arr[i]]
  }

  return res
}

export function getUrlParam(sUrl: string, sKey?: string): any {
  try {
    new URL(sUrl)
  } catch (error) {
    return null
  }

  const paramArr = sUrl.split('?')[1]?.split('#')[0]?.split('&') || []
  const obj: Record<string, string | string[]> = {}
  paramArr.forEach((element) => {
    const [key, value] = element.split('=')
    if (obj[key] === void 0) {
      obj[key] = value
    } else if (Array.isArray(obj[key])) {
      obj[key] = ([] as string[]).concat([...obj[key], value])
    } else {
      obj[key] = [obj[key] as string, value]
    }
  })

  return sKey === void 0 ? obj : obj[sKey] || ''
}

// Say you need to fetch some data through 100 APIs, and as soon as possible.
// If you use `Promise.all()`, 100 requests go to your server at the same time, which is a burden to low spec servers.
// Can you **throttle your API calls so that always maximum 5 API calls at the same time**?
// You are asked to create a general `throttlePromises()` which takes an array of functions returning promises,
// and a number indicating the maximum concurrent pending promises.
export function throttlePromises(funcs, max) {
  const results: any[] = []
  async function doWork(iterator) {
    for (const [index, item] of iterator) {
      const result = await item()
      results[index] = result
    }
  }
  const iterator = Array.from(funcs).entries()
  const workers = Array(max).fill(iterator).map(doWork)
  return Promise.all(workers).then(() => results)
}

// Promise.any
export function any(promises: Promise<any>[]): Promise<any> {
  return new Promise((resolve, reject) => {
    let isFulfilled = false
    const errors: any[] = []
    let errorCount = 0

    promises.forEach((promise, index) =>
      promise.then(
        (data) => {
          if (!isFulfilled) {
            resolve(data)
            isFulfilled = true
          }
        },
        (error) => {
          errors[index] = error
          errorCount++
          if (errorCount === promises.length) {
            reject(new Error('none resolved: ' + errors.join(', ')))
          }
        }
      )
    )
  })
}

// Promise.allSettled
type SettledPromise = { status: 'fulfilled'; value: any } | { status: 'rejected'; reason: any }
export function allSettled(promises: Promise<any>[]): Promise<SettledPromise[]> {
  if (promises.length === 0) return Promise.resolve([])

  const results: SettledPromise[] = []
  let completed = 0

  return new Promise((resolve) => {
    for (let i = 0; i < promises.length; i++) {
      Promise.resolve(promises[i])
        .then((value) => {
          results[i] = { status: 'fulfilled', value }
        })
        .catch((reason) => {
          results[i] = { status: 'rejected', reason }
        })
        .finally(() => {
          completed++
          if (completed === promises.length) resolve(results)
        })
    }
  })
}

// Promise.all
export function all(promises: Promise<any>[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = []
    let pending = promises.length

    for (let i = 0; i < promises.length; i++) {
      promises[i]
        .then((result) => {
          results[i] = result
          pending--

          if (pending === 0) {
            resolve(results)
          }
        })
        .catch(reject)
    }

    if (promises.length === 0) {
      resolve(results)
    }
  })
}

export function promisify(f: Function): (...args: any[]) => Promise<any> {
  return function (...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      function callback(err: any, result: any) {
        if (err) reject(err)
        else resolve(result)
      }
      args.push(callback)
      f.call(this, ...args)
    })
  }
}

const PENDING = 'pending'
const RESOLVED = 'resolved'
const REJECTED = 'rejected'

export class MyPromise {
  private state: string = PENDING
  private value: any = null
  private resolvedCallbacks: any[] = []
  private rejectedCallbacks: any[] = []

  constructor(fn: Function) {
    try {
      fn(this.resolve.bind(this), this.reject.bind(this))
    } catch (error) {
      this.reject(error)
    }
  }

  then(onResolved: Function, onRejected: Function) {
    onResolved =
      typeof onResolved === 'function'
        ? onResolved
        : function (value: any) {
            return value
          }
    onRejected =
      typeof onRejected === 'function'
        ? onRejected
        : function (error: Error) {
            throw error
          }

    if (this.state === PENDING) {
      this.resolvedCallbacks.push(onResolved)
      this.rejectedCallbacks.push(onRejected)
    }
    if (this.state === RESOLVED) {
      onResolved(this.value)
    }
    if (this.state === REJECTED) {
      onRejected(this.value)
    }
  }

  private resolve(value: any) {
    if (value instanceof MyPromise) {
      return value.then(this.resolve.bind(this), this.reject.bind(this))
    }

    setTimeout(() => {
      if (this.state === PENDING) {
        this.state = RESOLVED
        this.value = value
        this.resolvedCallbacks.forEach((callback) => {
          callback(this.value)
        })
      }
    }, 0)
  }

  private reject(value: any) {
    setTimeout(() => {
      if (this.state === PENDING) {
        this.state = REJECTED
        this.value = value
        this.rejectedCallbacks.forEach((callback) => {
          callback(this.value)
        })
      }
    }, 0)
  }
}

export class EventEmitter {
  private list: { [event: string]: Function[] } = {}

  on(event: string, fn: Function): this {
    ;(this.list[event] || (this.list[event] = [])).push(fn)
    return this
  }

  once(event: string, fn: Function): this {
    function on(this: EventEmitter) {
      this.off(event, fn)
      fn.apply(this, arguments)
    }
    on.fn = fn
    this.on(event, on)
    return this
  }

  off(event: string, fn?: Function): this | boolean {
    let fns = this.list[event]
    if (!fns) return false
    if (!fn) {
      fns.length = 0
    } else {
      fns.splice(fns.indexOf(fn), 1)
    }
    return this
  }

  emit(event: string, ...args: any[]): this | boolean {
    const fns = this.list[event]
    if (!fns || fns.length === 0) return false
    fns.forEach((fn) => fn.apply(this, args))
    return this
  }
}

export function myInstanceof(left, right) {
  let proto = Object.getPrototypeOf(left)
  const prototype = right.prototype
  while (true) {
    if (!proto) return false
    if (proto === prototype) return true
    proto = Object.getPrototypeOf(proto)
  }
}

export function myNew(...args: any[]): object | null {
  let newObject: object | null = null
  const constructor: Function = args.shift()
  let result: any = null

  if (typeof constructor !== 'function') {
    console.log('type error')
    return null
  }

  newObject = Object.create(constructor.prototype)
  result = constructor.apply(newObject, args)

  return (result && (typeof result === 'object' || typeof result === 'function')) || newObject ? result : newObject
}

const toString = Object.prototype.toString

function isFunction(obj: any): boolean {
  return toString.call(obj) === '[object Function]'
}

export function eq(a: any, b: any, aStack?: any[], bStack?: any[]): boolean {
  if (a === b) return a !== 0 || 1 / a === 1 / b
  if (a == null || b == null) return false
  if (a !== a) return b !== b
  const type = typeof a
  if (type !== 'function' && type !== 'object' && typeof b !== 'object') return false
  return deepEq(a, b, aStack, bStack)
}

function deepEq(a: any, b: any, aStack: any[] = [], bStack: any[] = []): boolean {
  const className = toString.call(a)
  if (className !== toString.call(b)) return false

  switch (className) {
    case '[object RegExp]':
    case '[object String]':
      return '' + a === '' + b
    case '[object Number]':
      if (+a !== +a) return +b !== +b
      return +a === 0 ? 1 / +a === 1 / b : +a === +b
    case '[object Date]':
    case '[object Boolean]':
      return +a === +b
  }

  const areArrays = className === '[object Array]'
  if (!areArrays) {
    if (typeof a !== 'object' || typeof b !== 'object') return false
    const aCtor = (a as object).constructor,
      bCtor = (b as object).constructor
    if (aCtor === bCtor && !(isFunction(aCtor) && aCtor instanceof aCtor && isFunction(bCtor) && bCtor instanceof bCtor && 'constructor' in a && 'constructor' in b)) {
      return false
    }
  }

  aStack = aStack || []
  bStack = bStack || []
  let length = aStack.length

  while (length--) {
    if (aStack[length] === a) {
      return bStack[length] === b
    }
  }

  aStack.push(a)
  bStack.push(b)

  if (areArrays) {
    length = a.length
    if (length !== b.length) return false
    while (length--) {
      if (!eq(a[length], b[length], aStack, bStack)) return false
    }
  } else {
    const keys = Object.keys(a)
    let key,
      length = keys.length
    if (Object.keys(b).length !== length) return false
    while (length--) {
      key = keys[length]
      if (!((b as object).hasOwnProperty(key) && eq(a[key], b[key], aStack, bStack))) return false
    }
  }

  aStack.pop()
  bStack.pop()
  return true
}

export const compose =
  (...args) =>
  (x) =>
    args.reduceRight((res, cb) => cb(res), x)

// const repeatFunc = repeat(console.log, 4, 3000, true);
// repeatFunc("hellworld"); //先立即打印一个hellworld，然后每三秒打印三个hellworld
export function repeat(func: (...args: any[]) => void, times: number, ms: number, immediate?: boolean): (...args: any[]) => void {
  let count = 0
  const ctx = null

  function inner(...args: any[]): void | number {
    count++
    if (count === 1 && immediate) {
      func.call(ctx, ...args)
      inner.call(ctx, ...args)
      return
    }
    if (count > times) return
    return setTimeout(() => {
      func.call(ctx, ...args)
      inner.call(ctx, ...args)
    }, ms)
  }

  return inner
}

export function flattenRecursive(arr: any[]) {
  return arr.reduce((prev: any[], next) => {
    return prev.concat(Array.isArray(next) ? flattenRecursive(next) : next)
  }, [])
}

export function flattenIterative(arr: any[]) {
  const result: any[] = []
  const stack = [...arr]
  while (stack.length !== 0) {
    const val = stack.pop()
    if (Array.isArray(val)) {
      stack.push(...val)
    } else {
      result.unshift(val)
    }
  }
  return result
}

export function flattenInplace(arr: any[]) {
  for (let i = 0; i < arr.length; ) {
    if (Array.isArray(arr[i])) {
      arr.splice(i, 1, ...arr[i])
    } else {
      i++
    }
  }
  return arr
}

export function bigNumberSum(a: string, b: string) {
  let cur = 0
  while (cur < a.length || cur < b.length) {
    if (!a[cur]) {
      a = '0' + a
    } else if (!b[cur]) {
      b = '0' + b
    }
    cur++
  }

  let carried = 0
  const res: number[] = []

  for (let i = a.length - 1; i > -1; i--) {
    const sum = carried + +a[i] + +b[i]
    if (sum > 9) {
      carried = 1
    } else {
      carried = 0
    }
    res[i] = sum % 10
  }

  if (carried === 1) res.unshift(1)

  return res.join('')
}

export function checkNullObj(obj) {
  return Object.keys(obj).length === 0 && Object.getOwnPropertySymbols(obj).length === 0
}

export function curry(fn: Function, ...args) {
  return fn.length <= args.length ? fn(...args) : curry.bind(null, fn, ...args)
}

export function myCall(thisArg, ...arr) {
  if (thisArg === null || thisArg === undefined) {
    thisArg = window
  } else {
    thisArg = Object(thisArg)
  }

  const specialMethod = Symbol('anything')
  thisArg[specialMethod] = this
  const result = thisArg[specialMethod](...arr)

  delete thisArg[specialMethod]
  return result
}

function isArrayLike(o) {
  return o && typeof o === 'object' && isFinite(o.length) && o.length >= 0 && o.length === Math.floor(o.length) && o.length < Number.MAX_SAFE_INTEGER
}

export function myApply(thisArg) {
  if (thisArg === null || thisArg === undefined) {
    thisArg = window
  } else {
    thisArg = Object(thisArg)
  }

  const specialMethod = Symbol('anything')
  thisArg[specialMethod] = this

  let args = arguments[1]
  let result

  if (args) {
    if (!Array.isArray(args) && !isArrayLike(args)) {
      throw new TypeError('')
    } else {
      args = Array.from(args)
      result = thisArg[specialMethod](...args)
    }
  } else {
    result = thisArg[specialMethod]()
  }

  delete thisArg[specialMethod]
  return result
}

export function myBind(objThis, ...params) {
  const thisFn = this
  const funcForBind = function (...secondParams) {
    const isNew = this instanceof funcForBind
    const thisArg = isNew ? this : Object(objThis)
    return thisFn.call(thisArg, ...params, ...secondParams)
  }
  funcForBind.prototype = Object.create(thisFn.prototype)
  return funcForBind
}

export function deepCopyRecursive(obj) {
  const map = new WeakMap()
  function dp(obj) {
    let result: any = null
    let keys: string[] = [],
      key = '',
      temp = null,
      existObj = null
    existObj = map.get(obj)
    if (existObj) return existObj
    result = {}
    map.set(obj, result)
    keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      key = keys[i]
      temp = obj[key]
      if (temp && typeof temp === 'object') {
        result[key] = dp(temp)
      } else {
        result[key] = temp
      }
    }
    return result
  }
  return dp(obj)
}

export function deepCopyIterative(x: any): any {
  const root: any = {}
  const loopList: { parent: any; key: string | undefined; data: any }[] = [
    {
      parent: root,
      key: undefined,
      data: x,
    },
  ]

  while (loopList.length) {
    const node = loopList.pop()
    const { parent, key, data } = node || {}
    let res = parent

    if (typeof key !== 'undefined') {
      res = parent![key] = {}
    }

    for (const k in data) {
      if (data.hasOwnProperty(k)) {
        if (typeof data[k] === 'object') {
          loopList.push({
            parent: res,
            key: k,
            data: data[k],
          })
        } else {
          res[k] = data[k]
        }
      }
    }
  }

  return root
}

export function debounce(fn: Function, delay: number): (...args: any[]) => void {
  let timer: number | null = null

  return function (...args: any[]): void {
    const context = this

    if (timer) clearTimeout(timer)

    timer = setTimeout(() => {
      fn.apply(context, args)
    }, delay)
  }
}

export function throttle(fn: Function, delay: number): (...args: any[]) => void {
  let last = 0

  return function (...args: any[]): void {
    const context = this
    const now = +new Date()

    if (now - last >= delay) {
      last = now
      fn.apply(context, args)
    }
  }
}

export function inherit(child: Function, parent: Function) {
  const parentPrototype = Object.create(parent.prototype)
  child.prototype = Object.assign(parentPrototype, child.prototype)
  child.prototype.constructor = child
}

export function randomSort1(arr: any[]) {
  let result: any[] = []

  while (arr.length > 0) {
    let randomIndex = Math.floor(Math.random() * arr.length)
    result.push(arr[randomIndex])
    arr.splice(randomIndex, 1)
  }

  return result
}

export function randomSort2(arr: any[]) {
  let index,
    randomIndex,
    len = arr.length

  for (index = 0; index < len; index++) {
    randomIndex = Math.floor(Math.random() * (len - index)) + index
    ;[arr[index], arr[randomIndex]] = [arr[randomIndex], arr[index]]
  }

  return arr
}

// 支持过期时间的 localStorage
;(function () {
  localStorage.setItem = function (key, value, time = Infinity) {
    const payload = Number.isFinite(time)
      ? {
          __data: value,
          __expiresTime: Date.now() + time,
        }
      : value
    Storage.prototype.setItem.call(localStorage, key, JSON.stringify(payload))
  }
  localStorage.getItem = function (key) {
    const value = Storage.prototype.getItem.call(localStorage, key)
    try {
      const jsonVal = JSON.parse(value)
      if (jsonVal.__expiresTime) {
        return jsonVal.__expiresTime >= Date.now() ? JSON.stringify(jsonVal.__data) : void 0
      }
      return value
    } catch (error) {
      return value
    }
  }
})()
