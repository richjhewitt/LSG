const eventNameInput = document.getElementById("eventName");
const startDateInput = document.getElementById("startDate");
const timezoneSelect = document.getElementById("timezone");
const pasteBox = document.getElementById("pasteBox");
const schedule = document.getElementById("schedule");
const scheduleTableWrap = document.getElementById("scheduleTableWrap");
const editViewButton = document.getElementById("editViewButton");
const tableViewButton = document.getElementById("tableViewButton");
const tzChecks = document.getElementById("tzChecks");
const output = document.getElementById("output");
const botOutput = document.getElementById("botOutput");
const colCountSelect = document.getElementById("colCount");
const flyerTimes = document.getElementById("flyerTimes");
const message = document.getElementById("message");
const toast = document.getElementById("toast");
let toastTimer = null;
let activeScheduleView = "edit";

// ---------- COPY ----------
function copy(id){
  const el = document.getElementById(id);
  if(!el) return;
  navigator.clipboard.writeText(el.value ?? el.textContent ?? "");
}

function setMessage(text=""){
  message.textContent = text;
}

function showToast(text){
  if(!text) return;
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("show"), 2600);
}

function clearFieldErrors(){
  document.querySelectorAll(".field-error").forEach(el=>el.classList.remove("field-error"));
}

function flagField(el){
  if(!el) return;
  el.classList.add("field-error");
  el.focus({preventScroll:true});
  setTimeout(()=>el.classList.remove("field-error"), 2200);
}

// ---------- TZ MAP ----------
const tzMap = {
  "Europe/London": "UK",
  "Europe/Paris": "EU",
  "Australia/Brisbane": "AUS",
  "America/New_York": "US East",
  "America/Chicago": "US Central",
  "America/Denver": "US Mountain",
  "America/Los_Angeles": "US Pacific"
};

// ---------- CHECKBOXES ----------
Object.entries(tzMap).forEach(([tz,label])=>{
  const div=document.createElement("div");
  div.innerHTML=`<input type="checkbox" checked value="${tz}"><br><span data-tz-label="${tz}">${label}</span>`;
  tzChecks.appendChild(div);
});

// ---------- NORMALISE ----------
function normaliseTime(t){
  if(!t) return "";
  t=t.trim().toLowerCase().replace(/\s+/g,"");

  if(t.includes(":") && !t.includes("am") && !t.includes("pm")){
    let [h,m]=t.split(":").map(Number);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }

  let m=t.match(/^(\d+)(?::(\d+))?(am|pm)$/);
  if(m){
    let h=+m[1],min=+(m[2]||0);
    if(m[3]==="pm"&&h!==12)h+=12;
    if(m[3]==="am"&&h===12)h=0;
    return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
  }
  return "";
}

// ---------- ROW ----------
const icons = {
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="18" r="1"></circle></svg>',
  addAbove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v10"></path><path d="M7 10l5-5 5 5"></path><path d="M6 19h12"></path></svg>',
  addBelow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V9"></path><path d="M7 14l5 5 5-5"></path><path d="M6 5h12"></path></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
  table: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M9 4v16"></path><path d="M15 4v16"></path></svg>'
};

let draggingRow = null;
let draggingNameInput = null;

function makeIconButton(label, icon, className=""){
  const button=document.createElement("button");
  button.className=`icon-button ${className}`.trim();
  button.type="button";
  button.title=label;
  button.setAttribute("aria-label", label);
  button.innerHTML=icon;
  return button;
}

editViewButton.innerHTML=icons.edit;
tableViewButton.innerHTML=icons.table;
editViewButton.onclick=()=>setScheduleView("edit");
tableViewButton.onclick=()=>setScheduleView("table");

function focusRow(row){
  const input=row?.querySelector(".name-input");
  if(input) input.focus();
}

function getScheduleRows(){
  return Array.from(schedule.querySelectorAll(".row"));
}

function getScheduleRowData(){
  return getScheduleRows().map(row=>({
    row,
    nameInput: row.querySelector(".name-input"),
    timeInput: row.querySelector(".time-input")
  }));
}

function moveNameToRow(targetRow){
  if(!draggingNameInput || !targetRow) return;
  const rows=getScheduleRows();
  const sourceRow=draggingNameInput.closest(".row");
  const sourceIndex=rows.indexOf(sourceRow);
  const targetIndex=rows.indexOf(targetRow);
  if(sourceIndex < 0 || targetIndex < 0 || sourceIndex===targetIndex) return;

  const names=rows.map(row=>row.querySelector(".name-input").value);
  const [name]=names.splice(sourceIndex, 1);
  names.splice(targetIndex, 0, name);

  rows.forEach((row,index)=>{
    row.querySelector(".name-input").value=names[index] || "";
  });
  rows[targetIndex].querySelector(".name-input").focus();
  renderScheduleTableIfActive();
}

function addRow(name="",time="",options={}){
  const r=document.createElement("div");
  r.className="row";
  const dragHandle=makeIconButton("Drag row", icons.grip, "drag-handle");
  dragHandle.draggable=true;
  dragHandle.addEventListener("dragstart",e=>{
    draggingRow=r;
    r.classList.add("dragging");
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain", "");
  });
  dragHandle.addEventListener("dragend",()=>{
    r.classList.remove("dragging");
    draggingRow=null;
  });

  const nameInput=document.createElement("input");
  nameInput.className="name-input";
  nameInput.value=name;
  nameInput.addEventListener("input", renderScheduleTableIfActive);

  const nameCell=document.createElement("div");
  nameCell.className="name-cell";

  const nameDragHandle=makeIconButton("Move streamer", icons.grip, "name-drag-handle");
  nameDragHandle.draggable=true;
  nameDragHandle.addEventListener("dragstart",e=>{
    if(!nameInput.value.trim()){
      e.preventDefault();
      return;
    }
    draggingNameInput=nameInput;
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain", nameInput.value);
  });
  nameDragHandle.addEventListener("dragend",()=>{
    draggingNameInput=null;
    getScheduleRows().forEach(row=>row.classList.remove("name-drop-target"));
  });
  nameCell.appendChild(nameInput);
  nameCell.appendChild(nameDragHandle);

  const timeInput=document.createElement("input");
  timeInput.className="time-input";
  timeInput.type="time";
  timeInput.value=normaliseTime(time);
  timeInput.addEventListener("input", renderScheduleTableIfActive);

  const actions=document.createElement("div");
  actions.className="row-actions";

  const addAboveButton=makeIconButton("Add row above", icons.addAbove);
  addAboveButton.onclick=()=>focusRow(addRow("","",{before:r, focus:true}));

  const addBelowButton=makeIconButton("Add row below", icons.addBelow);
  addBelowButton.onclick=()=>focusRow(addRow("","",{after:r, focus:true}));

  const removeButton=makeIconButton("Delete row", icons.trash, "danger");
  removeButton.onclick=()=>{
    r.remove();
    renderScheduleTableIfActive();
  };

  actions.appendChild(addAboveButton);
  actions.appendChild(addBelowButton);
  actions.appendChild(removeButton);

  r.appendChild(dragHandle);
  r.appendChild(nameCell);
  r.appendChild(timeInput);
  r.appendChild(actions);

  if(options.before){
    schedule.insertBefore(r, options.before);
  }else if(options.after){
    options.after.insertAdjacentElement("afterend", r);
  }else{
    schedule.appendChild(r);
  }

  if(options.focus) focusRow(r);
  renderScheduleTableIfActive();
  return r;
}

schedule.addEventListener("dragover",e=>{
  const row=e.target.closest(".row");

  if(draggingNameInput){
    e.preventDefault();
    getScheduleRows().forEach(scheduleRow=>{
      scheduleRow.classList.toggle("name-drop-target", scheduleRow===row);
    });
    return;
  }

  if(!draggingRow) return;
  e.preventDefault();
  if(!row || row===draggingRow || row.parentElement!==schedule) return;
  const box=row.getBoundingClientRect();
  const after=e.clientY > box.top + box.height / 2;
  schedule.insertBefore(draggingRow, after ? row.nextSibling : row);
});

schedule.addEventListener("drop",e=>{
  if(draggingNameInput){
    e.preventDefault();
    moveNameToRow(e.target.closest(".row"));
    getScheduleRows().forEach(row=>row.classList.remove("name-drop-target"));
    draggingNameInput=null;
    return;
  }

  if(draggingRow) e.preventDefault();
  renderScheduleTableIfActive();
});

function setScheduleView(view){
  activeScheduleView=view;
  const showTable=view==="table";
  schedule.classList.toggle("hidden", showTable);
  document.querySelector(".row-header").classList.toggle("hidden", showTable);
  scheduleTableWrap.classList.toggle("active", showTable);
  editViewButton.classList.toggle("active", !showTable);
  tableViewButton.classList.toggle("active", showTable);
  if(showTable) renderScheduleTable();
}

function renderScheduleTableIfActive(){
  if(activeScheduleView==="table") renderScheduleTable();
}

function getTableTimezones(){
  const selected=getSelectedTimezones();
  const sourceTz=resolveInputTimezone();
  return selected.includes(sourceTz) ? selected : [sourceTz, ...selected];
}

function getScheduleDatetimes(){
  const data=getScheduleRowData();
  if(!startDateInput.value) return data.map(item=>({...item, date:null}));
  const [y,m,d]=startDateInput.value.split("-").map(Number);
  const sourceTz=resolveInputTimezone();
  let prev=null,off=0;
  return data.map(item=>{
    if(!item.timeInput.value){
      return {...item, date:null};
    }
    const [h,mi]=item.timeInput.value.split(":").map(Number);
    if(prev!==null && h<prev) off++;
    prev=h;
    return {
      ...item,
      date: makeUTCDate(y,m,d+off,h,mi,sourceTz)
    };
  });
}

function renderScheduleTable(){
  const data=getScheduleDatetimes();
  const tzs=getTableTimezones();
  const sourceTz=resolveInputTimezone();
  const referenceKey=startDateInput.value || getTimeZoneDateKey(getReferenceDate(), sourceTz);
  const table=document.createElement("table");
  table.className="schedule-table";

  const thead=document.createElement("thead");
  const headRow=document.createElement("tr");
  ["twitch.tv/", ...tzs.map(tz=>getLabel(tz,getReferenceDate()))].forEach(label=>{
    const th=document.createElement("th");
    th.textContent=label;
    headRow.appendChild(th);
  });
  headRow.querySelectorAll("th").forEach((th,index)=>{
    if(index > 0 && tzs[index-1]===sourceTz) th.classList.add("source-col");
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody=document.createElement("tbody");
  data.forEach(item=>{
    const tr=document.createElement("tr");

    const nameCell=document.createElement("td");
    const nameInput=document.createElement("input");
    nameInput.className="table-name-input";
    nameInput.value=item.nameInput.value;
    nameInput.addEventListener("input",()=>{
      item.nameInput.value=nameInput.value;
    });
    nameCell.appendChild(nameInput);
    tr.appendChild(nameCell);

    tzs.forEach(tz=>{
      const td=document.createElement("td");
      const isSource=tz===sourceTz;
      if(isSource) td.classList.add("source-col");

      if(isSource){
        const timeInput=document.createElement("input");
        timeInput.type="time";
        timeInput.value=item.timeInput.value;
        timeInput.addEventListener("change",()=>{
          item.timeInput.value=timeInput.value;
          renderScheduleTable();
        });
        td.appendChild(timeInput);
      }else{
        const div=document.createElement("div");
        div.className="readonly-time";
        if(item.date){
          const t=getTimeParts(item.date,tz);
          div.textContent=formatTime(t.h,t.m,tz);
          const localKey=getTimeZoneDateKey(item.date,tz);
          const offset=dateKeyOffset(referenceKey,localKey);
          if(offset>0) div.classList.add("rollover-forward");
          if(offset<0) div.classList.add("rollover-back");
        }else{
          div.textContent="";
        }
        td.appendChild(div);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  scheduleTableWrap.replaceChildren(table);
}

// ---------- PARSER ----------
function parseSchedule(){
  schedule.innerHTML="";
  pasteBox.value.trim().split("\n").forEach(line=>{
    const p=line.trim().split(/\s+/).filter(Boolean);
    if(p.length>=2){
      const norm=normaliseTime(p[p.length-1]);
      if(norm) addRow(p[0],norm);
    }
  });
  setMessage("");
}

pasteBox.addEventListener("paste",()=>{
  setTimeout(parseSchedule,0);
});

startDateInput.addEventListener("change", updateTimezoneLabels);
timezoneSelect.addEventListener("change", renderScheduleTableIfActive);
tzChecks.addEventListener("change", renderScheduleTableIfActive);

function getRows(){
  const rows=[];
  document.querySelectorAll(".row").forEach(r=>{
    const n=r.querySelector(".name-input").value.trim();
    const t=r.querySelector(".time-input").value;
    if(n&&t) rows.push({name:n,time:t});
  });
  return rows;
}

function getSelectedTimezones(){
  return Array.from(document.querySelectorAll("#tzChecks input:checked")).map(cb=>cb.value);
}

function validateInputs(options={}){
  const rows=getRows();
  clearFieldErrors();

  if(!startDateInput.value){
    const msg="Please choose a start date first.";
    setMessage(msg);
    showToast(msg);
    flagField(startDateInput);
    return null;
  }

  if(rows.length===0){
    const msg="Please add at least one valid schedule row first.";
    setMessage(msg);
    showToast(msg);
    flagField(pasteBox);
    return null;
  }

  if(options.requireTimezones){
    const tzs=getSelectedTimezones();
    if(tzs.length===0){
      const msg="Please select at least one timezone first.";
      setMessage(msg);
      showToast(msg);
      flagField(tzChecks.querySelector("input"));
      return null;
    }
    return {rows, tzs};
  }

  return {rows};
}

// ---------- TIME ----------
function makeUTCDate(y,m,d,h,min,tz){
  if(tz==="auto") return new Date(y,m-1,d,h,min);
  const guess=new Date(Date.UTC(y,m-1,d,h,min));
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour12:false,
    year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit"}).formatToParts(guess);
  const v={}; parts.forEach(p=>v[p.type]=p.value);
  const asUTC=Date.UTC(v.year,v.month-1,v.day,v.hour,v.minute);
  return new Date(guess.getTime()-(asUTC-guess.getTime()));
}

function getTimeParts(date,tz){
  const p=new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit"}).formatToParts(date);
  let h=0,m=0;
  p.forEach(x=>{if(x.type==="hour")h=+x.value;if(x.type==="minute")m=+x.value});
  return {h,m};
}

function formatTime(h,m,tz){
  if(tz.includes("America")){
    let hr=h%12||12;
    let s=h>=12?"pm":"am";
    return m?`${hr}:${String(m).padStart(2,"0")}${s}`:`${hr}${s}`;
  }
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function getReferenceDate(){
  if(startDateInput.value){
    const [y,m,d]=startDateInput.value.split("-").map(Number);
    return new Date(y,m-1,d,12);
  }
  return new Date();
}

function getLabel(tz,date){
  const str=new Intl.DateTimeFormat("en-GB",{timeZone:tz,timeZoneName:"shortOffset"}).format(date);
  if(tz==="Europe/London") return str.includes("+1")?"BST":"GMT";
  if(tz==="Europe/Paris") return str.includes("+2")?"CEST":"CET";
  if(tz==="Australia/Brisbane") return "AEST";
  if(tz==="America/New_York") return str.includes("-4")?"EDT":"EST";
  if(tz==="America/Chicago") return str.includes("-5")?"CDT":"CST";
  if(tz==="America/Denver") return str.includes("-6")?"MDT":"MST";
  if(tz==="America/Los_Angeles") return str.includes("-7")?"PDT":"PST";
}

function getTimeZoneDateKey(date,tz){
  const p=new Intl.DateTimeFormat("en-CA",{
    timeZone:tz,
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).formatToParts(date);
  const v={};
  p.forEach(x=>v[x.type]=x.value);
  return `${v.year}-${v.month}-${v.day}`;
}

function getRowDatetimes(rows,sourceTz){
  if(!startDateInput.value) return [];
  const [y,m,d]=startDateInput.value.split("-").map(Number);
  let prev=null,off=0;
  return rows.map(row=>{
    if(!row.time){
      return {...row, date:null};
    }
    const [h,mi]=row.time.split(":").map(Number);
    if(prev!==null && h<prev) off++;
    prev=h;
    return {
      ...row,
      date: makeUTCDate(y,m,d+off,h,mi,sourceTz)
    };
  });
}

function dateKeyOffset(fromKey,toKey){
  const from=new Date(`${fromKey}T00:00:00Z`);
  const to=new Date(`${toKey}T00:00:00Z`);
  return Math.round((to-from)/86400000);
}

function resolveInputTimezone(){
  const selected=timezoneSelect.value;
  if(selected!=="auto") return selected;

  const local=Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
  if(tzMap[local]) return local;
  if(local==="Europe/Dublin" || local==="Europe/Lisbon") return "Europe/London";
  if(local.startsWith("Europe/")) return "Europe/Paris";
  if(local==="Australia/Brisbane") return "Australia/Brisbane";

  const usMap = {
    "America/New_York": "America/New_York",
    "America/Detroit": "America/New_York",
    "America/Indiana/Indianapolis": "America/New_York",
    "America/Chicago": "America/Chicago",
    "America/Winnipeg": "America/Chicago",
    "America/Denver": "America/Denver",
    "America/Phoenix": "America/Denver",
    "America/Los_Angeles": "America/Los_Angeles",
    "America/Vancouver": "America/Los_Angeles"
  };
  return usMap[local] || "Europe/London";
}

function updateTimezoneLabels(){
  const date=getReferenceDate();
  document.querySelectorAll("[data-tz-label]").forEach(el=>{
    el.textContent=getLabel(el.dataset.tzLabel,date);
  });
  if(activeScheduleView==="table") renderScheduleTable();
}

// ---------- HAMMERTIME ----------
function generateHammertime(){
  const valid=validateInputs();
  if(!valid) return;

  const {rows}=valid;
  let [y,m,d]=startDateInput.value.split("-").map(Number);
  let prev=null,off=0,out="",first=null;

  rows.forEach(r=>{
    const [h,mi]=r.time.split(":").map(Number);
    if(prev!==null && h<prev) off++;
    prev=h;

    const dt=makeUTCDate(y,m,d+off,h,mi,timezoneSelect.value);
    const unix=Math.floor(dt/1000);
    if(!first) first=unix;

    out+=`> [${r.name}](https://twitch.tv/${r.name}) - <t:${unix}:t>\n`;
  });

  output.textContent=`🚂 ${eventNameInput.value} - <t:${first}:R>\n`+out.trim();
  setMessage("");
}

// ---------- BOT ----------
function generateBot(){
  const valid=validateInputs({requireTimezones:true});
  if(!valid) return;

  const {rows, tzs}=valid;
  const base=getReferenceDate();
  const datedRows=getRowDatetimes(rows, timezoneSelect.value);

  let out="";
  tzs.forEach(tz=>{
    let line=`🚂 ${eventNameInput.value} (${getLabel(tz,base)}):`;

    datedRows.forEach(r=>{
      if(!r.date) return;
      const t=getTimeParts(r.date,tz);
      line+=` 🚃 ${formatTime(t.h,t.m,tz)} @${r.name}`;
    });

    out+="`"+line+"`\n\n";
  });

  botOutput.textContent=out.trim();
  setMessage("");
}

// ---------- SPLIT ----------
function splitColumns(arr, cols){
  const out=[];
  const base=Math.floor(arr.length/cols);
  let extra=arr.length%cols;
  let i=0;

  for(let c=0;c<cols;c++){
    let size=base+(extra>0?1:0);
    if(extra>0) extra--;
    out.push(arr.slice(i,i+size));
    i+=size;
  }
  return out;
}

// ---------- FLYER ----------
function generateFlyer(){
  const valid=validateInputs({requireTimezones:true});
  if(!valid) return;

  const {rows, tzs}=valid;
  const cols=parseInt(colCountSelect.value,10);
  const referenceDate=getReferenceDate();
  const datedRows=getRowDatetimes(rows, timezoneSelect.value);
  const split=splitColumns(datedRows,cols);

  flyerTimes.innerHTML="";

  const row=document.createElement("div");
  row.className="flyer-row names-times";

  function buildBlock(title, fn, idPrefix){
    const wrap=document.createElement("div");
    wrap.className="tz-block";
    wrap.classList.add(title==="Names" ? "names-block" : "time-block");
    wrap.innerHTML=`<strong>${title}</strong>`;

    const inner=document.createElement("div");
    inner.className="inner";
    inner.style.gridTemplateColumns=`repeat(${cols}, minmax(0, 1fr))`;

    split.forEach((col,i)=>{
      const group=document.createElement("div");
      group.className="flyer-col";

      const ta=document.createElement("textarea");
      ta.id=idPrefix+"_"+i;
      const text=fn(col);
      ta.value=text;
      ta.rows=Math.max(text ? text.split("\n").length : 1, 1);

      const btn=document.createElement("button");
      btn.className="flyer-copy";
      btn.type="button";
      btn.title="Copy";
      btn.setAttribute("aria-label","Copy");
      btn.textContent="⧉";
      btn.onclick=()=>copy(ta.id);

      group.appendChild(btn);
      group.appendChild(ta);
      inner.appendChild(group);
    });

    wrap.appendChild(inner);
    return wrap;
  }

  row.appendChild(buildBlock("Names",col=>col.map(r=>r.name).join("\n"),"n"));

  tzs.forEach((tz,index)=>{
    row.appendChild(buildBlock(
      getLabel(tz,referenceDate),
      col=>{
        return col.map(r=>{
          if(!r.date) return "";
          const t=getTimeParts(r.date,tz);
          return formatTime(t.h,t.m,tz);
        }).join("\n");
      },
      tz
    ));
  });

  flyerTimes.appendChild(row);
  setMessage("");
}

updateTimezoneLabels();
