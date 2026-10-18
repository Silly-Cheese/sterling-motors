export function localISODate(value=new Date()){
 if(!(value instanceof Date)||!Number.isFinite(value.getTime()))throw Error("Invalid date.");
 return value.getFullYear()+"-"+String(value.getMonth()+1).padStart(2,"0")+"-"+String(value.getDate()).padStart(2,"0");
}
export function displayDate(value){
 if(!value)return "—";
 let d;
 if(typeof value==="string"&&/^\d{4}-\d\d-\d\d$/.test(value)){
  const [y,m,day]=value.split("-").map(Number);
  d=new Date(y,m-1,day);
  if(d.getFullYear()!==y||d.getMonth()+1!==m||d.getDate()!==day)return "—";
 }else d=value?.toDate?value.toDate():new Date(value);
 if(!Number.isFinite(d.getTime()))return "—";
 return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
