import RulesHTML from './rules.html'

export const api = {
  icon: '⚡️',
  name: 'tests.do',
  description: 'Test your responses in a single URL.',
  url: 'https://tests.do/api',
  type: 'https://apis.do/testing',
  endpoints: {
    test: 'https://tests.do/:endpoint',
  },
  site: 'https://tests.do',
  login: 'https://tests.do/login',
  signup: 'https://tests.do/signup',
  subscribe: 'https://tests.do/subscribe',
  repo: 'https://github.com/drivly/tests.do',
}

export const gettingStarted = [
]

export const examples = {
  testEquals: 'https://assert.tests.do/status==200&body.data.boolean==true/tests.tailwind.do/api/tests/demo',
  testNotEquals: 'https://assert.tests.do/status==200&body.data.boolean!=false/bypass.tests.do/api/tests/demo',
  testContains: 'https://assert.tests.do/status==200&body.data.string+=hello%20world/bypass.tests.do/api/tests/demo',
  testNotContains: 'https://assert.tests.do/status==200&body.data.string-=foo/bypass.tests.do/api/tests/demo',
}

export const tests = {
  testEquals: 'https://assert.tests.do/status==200&body.data.boolean==true/tests.tailwind.do/api/tests/demo',
  testNotEquals: 'https://assert.tests.do/status==200&body.data.boolean!=false/bypass.tests.do/api/tests/demo',
  testContains: 'https://assert.tests.do/status==200&body.data.string+=hello%20world/bypass.tests.do/api/tests/demo',
  testNotContains: 'https://assert.tests.do/status==200&body.data.string-=foo/bypass.tests.do/api/tests/demo',
}

export default {
	fetch: async (req, env, ctx) => {
	  const { user, origin, hostname, requestId, method, time, pathname, pathSegments, pathOptions, url, query } = await env.CTX.fetch(req.clone()).then(res => res.json())
	  const json=(e,t)=>(ctx.waitUntil(fetch(`https://debug.do/ingest/${req.headers.get("CF-Ray")}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({request:{url:req.url,method:req.method,headers:Object.fromEntries(req.headers),query:Object.fromEntries(new URL(req.url).searchParams)},response:e,user,status: t?.status || 200})})),new Response(JSON.stringify(e,null,2),{headers:{"content-type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, PUT, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Requested-With","Cache-Control":"no-cache, no-store, must-revalidate"},...t}))
	  
	  if (pathname == '/api') return new Response(JSON.stringify({ api, gettingStarted, examples, tests, user }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' }})

    if (pathname == '/api/tests/demo') return json({ api, data: { boolean: true, number: 123, string: 'hello world' }, user }, { status: 200 })

    if (pathname == '/api/rules') return await fetch(`https://tailwind.do/inline`, { method: 'POST', headers: { 'content-type': 'text/html' }, body: RulesHTML })

    if (pathname == '/api/tests') {
      const testResults = []
      for (const [name, url] of Object.entries(tests)) {
        const res = await fetch(url.replaceAll('assert.tests.do', hostname).replaceAll('tests.do', hostname)).then(res => res.json())
        
        testResults.push({
          name,
          url: url.replaceAll('assert.tests.do', hostname).replaceAll('tests.do', hostname),
          result: res.data.result,
        })
      }

      return json({ api, data: testResults, user  }, { status: 200 })
    }

    // URL structure is like so:
    // /:query/:url
    // e.g. /headers.status==200&body!=null&body.length>0/bodyc=hello, world/bucket.do/list

    // Parse the testing string from the first segment
    const testString = pathSegments[0].replace(/\\/g, '/').replace(/\\\\/g, '\\')

    const testsToRun = []

    for (const test of testString.split('&')) {
      // The test is a string like "headers.status==200"
      // There are also extra operators like "headers.status+=200" (includes) and "headers.status-=200" (excludes)
      // Split it into the key, operator, and value

      let [key, operator, value] = test.split(/([=!<>+-]=)/)

      if (!['==', '!=', '>=', '<=', '+=', '-='].includes(operator)) {
        // This is an invalid operator, so return an error
        return json({
          api,
          data: {
            success: false,
            error: `Invalid operator: ${operator}`,
          },
          user
        }, { status: 400 })
      }

      try {
        value = JSON.parse(decodeURIComponent(value).trim())
      } catch (e) {
        value = decodeURIComponent(value).trim()
      }

      key = key.trim()

      testsToRun.push({ key, operator, value, testName: test })
    }

    console.log(testsToRun)

    const fetchStart = Date.now()

    // To prevent routing issues, we convert `/` to `\` when sending in the request,
    // we need to reverse this. Except for `\\` which is a literal `\`

    // turn the query object into a url query string using URLSearchParams
    

    const target = pathSegments.slice(1).join('/')
    const response = await fetch(`https://` + target + '?' + new URLSearchParams(query).toString())

    const fetchMs = Date.now() - fetchStart

    const body = await response.text()

    let jsonBody

    try {
      jsonBody = JSON.parse(body)
    } catch (e) {}

    const scope = {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      'body-text': body,
      body: jsonBody,
      latency: fetchMs,
    }

    console.log(scope)

    const results = []

    for (const test of testsToRun) {
      const { key, operator, value, testName } = test

      // Key could be a nested object, like "headers.status"
      // So we need to unpack it and get the value from the scope

      const keys = key.split('.')
      let targetVar = scope

      let i = 0

      for (const key of keys) {
        // if the last key is "type", then we need to get the type of the targetVar
        // instead of the targetVar itself

        if (i == keys.length - 1 && key == 'type') {
          targetVar = typeof targetVar

          if (Array.isArray(targetVar)) targetVar = 'array' // Dont you just love JS? :)
        } else {
          try {
            targetVar = targetVar[key]
          } catch (e) {
            return json({
              api,
              data: {
                success: false,
                error: `Invalid key used, ${keys.join('.')} not found in scope`,
              },
              user
            }, { status: 400 })
          }
        }

        i++
      }
      
      const result = {
        '==': (a, b) => a == b,
        '!=': (a, b) => a != b,
        '>=': (a, b) => a >= b,
        '<=': (a, b) => a <= b,
        '+=': (a, b) => a.includes(b),
        '-=': (a, b) => !a.includes(b)
      }[operator](targetVar, value)

      results.push({ 'test': testName, result, value: targetVar })
    }

    return json({
      api,
      data: {
        success: true,
        fetchMs: fetchMs,
        // If all tests passed, return 'passed', if all failed, return 'failed', otherwise return 'partial'
        result: results.filter(r => !r.result).length == 0 ? 'passed' : ( results.filter(r => r.result).length == 0 ? 'failed' : 'partial' ),
        tests: results.length,
        passed: results.filter(r => r.result).length,
        results,
      },
      user
    })
	},
}

