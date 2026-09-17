export async function readJson(response:Response){const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))return {error:'服務回應格式錯誤。'};return response.json();}
