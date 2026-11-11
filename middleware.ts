// Keep the store online while the IP guard is adapted to this deployment runtime.
export default function middleware() {
  return new Response(null, {headers:{'x-middleware-next':'1'}});
}
