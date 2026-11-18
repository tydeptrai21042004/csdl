export interface Trip {
  trip_id:number; route_id:number; bus_id:number; operator_id:number; operator_name:string;
  origin:string; destination:string; license_plate:string; departure_at:string; arrival_at:string;
  base_fare:number|string; status:string; available_seats:number;
}
export interface RouteOption {route_id:number; operator_id:number; operator_name:string; origin:string;destination:string}
export interface BusOption {bus_id:number;operator_id:number;license_plate:string;bus_type:string}
export interface OperatorOption {operator_id:number;operator_name:string}
export interface Booking {booking_id:number;trip_id:number;status:string;booked_at:string;expires_at:string;total_amount:number|string;purchaser:string;departure_at:string;ticket_count:number}
export const money = (value:number|string) => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(value));
export const dateTime = (value:string) => new Date(value).toLocaleString('vi-VN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
export const dateOnly = (value:Date) => {
 const d=new Date(value.getTime()-value.getTimezoneOffset()*60_000);
 return d.toISOString().slice(0,10);
};
export const toLocalInput = (iso: string) => {
 const d=new Date(iso); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
export async function api<T=unknown>(url:string, options?:RequestInit):Promise<T> {
 const response=await fetch(url,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options?.headers||{})}});
 const data=await response.json().catch(()=>({error:'Invalid server response'}));
 if(!response.ok) throw new Error(data.error||`HTTP ${response.status}`);
 return data as T;
}
export const jsonBody = (value:unknown) => JSON.stringify(value);
