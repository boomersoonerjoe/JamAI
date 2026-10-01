import {AppData,emptyData} from "./types";
const KEY="nhomeai.state.v1";
export function loadData():AppData {
  const raw=localStorage.getItem(KEY); if(!raw) return emptyData();
  const parsed=JSON.parse(raw) as AppData;
  if(parsed.schemaVersion!==1) throw new Error("This data was saved by a newer NhomeAI version.");
  return parsed;
}
export function saveData(data:AppData){ localStorage.setItem(KEY,JSON.stringify(data)); }
