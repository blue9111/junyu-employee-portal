import {useEffect,useMemo,useState,type DragEvent,type FormEvent} from 'react';
import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,type Auth,type User} from 'firebase/auth';
import {Activity,BarChart3,Bell,BriefcaseBusiness,CalendarDays,Check,ChevronRight,Clock3,CloudSun,Download,GripVertical,HeartPulse,LogOut,MessageCircle,Monitor,Moon,Newspaper,Plus,Search,Send,Settings,ShieldCheck,Sparkles,SunMedium,Trophy,Users,X} from 'lucide-react';
import {readJson} from './api';

type Employee={email:string;name:string;employeeId:string;departmentCode?:string;unit?:string;jobTitle?:string};
type TaskStatus='todo'|'doing'|'done';
type Task={id:string;title:string;notes:string;dueDate:string;priority:'low'|'normal'|'high';status:TaskStatus;version:number};
type NewTask={title:string;notes:string;dueDate:string;priority:Task['priority']};
type Mood='fire'|'great'|'okay'|'meh'|'struggling';
type ThemeMode='light'|'dark'|'system';
type GamificationTab='achievements'|'leaderboard';
type AchievementCategory='all'|'productivity'|'collaboration'|'learning'|'milestones';
type DashboardData={date:string;moodCounts:Record<Mood,number>;checkins:number;chats:Array<{id:string;authorEmail:string;authorName:string;text:string;createdAt:string}>;activities:Array<{id:string;actorEmail:string;actorName:string;kind:'task'|'mood'|'chat';text:string;createdAt:string}>};
type ChatPerson={email:string;name:string;online:boolean;lastSeen:string};
type DirectMessage={id:string;authorEmail:string;authorName:string;recipientEmail:string;text:string;createdAt:string};
type WeatherData={temperature:number;humidity:number;wind:number;code:number};
type CardId='stats'|'schedule'|'tasks'|'quick'|'weather'|'news'|'profile'|'analytics';
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};

const defaultCardOrder:CardId[]=['stats','schedule','tasks','quick','weather','news','profile','analytics'];
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date());
const emptyTask=():NewTask=>({title:'',notes:'',dueDate:today(),priority:'normal'});
const statusLabel:Record<TaskStatus,string>={todo:'待處理',doing:'進行中',done:'已完成'};
const nextStatus:Record<TaskStatus,TaskStatus>={todo:'doing',doing:'done',done:'todo'};
const moodOptions:Array<{id:Mood;emoji:string;label:string}>=[{id:'fire',emoji:'🔥',label:'充滿幹勁'},{id:'great',emoji:'😊',label:'很好'},{id:'okay',emoji:'😌',label:'還可以'},{id:'meh',emoji:'😐',label:'普通'},{id:'struggling',emoji:'😩',label:'需要協助'}];
const blankDashboard:DashboardData={date:today(),moodCounts:{fire:0,great:0,okay:0,meh:0,struggling:0},checkins:0,chats:[],activities:[]};
const timeLabel=(value:string)=>new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Taipei'}).format(new Date(value));

export default function App(){
  const [auth,setAuth]=useState<Auth|null>(null);
  const [user,setUser]=useState<User|null>(null);
  const [employee,setEmployee]=useState<Employee|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [dashboard,setDashboard]=useState<DashboardData>(blankDashboard);
  const [weather,setWeather]=useState<WeatherData|null>(null);
  const [weatherLocation,setWeatherLocation]=useState('正在取得位置…');
  const [checking,setChecking]=useState(true);
  const [message,setMessage]=useState('正在連線員工工作入口…');
  const [query,setQuery]=useState('');
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState<NewTask>(emptyTask());
  const [busy,setBusy]=useState(false);
  const [cardOrder,setCardOrder]=useState<CardId[]>(defaultCardOrder);
  const [draggingCard,setDraggingCard]=useState<CardId|null>(null);
  const [theme,setTheme]=useState<ThemeMode>(()=>(localStorage.getItem('junyu-theme') as ThemeMode)||'system');
  const [chatText,setChatText]=useState('');
  const [chatPeople,setChatPeople]=useState<ChatPerson[]>([]);
  const [selectedChatEmail,setSelectedChatEmail]=useState<string|null>(null);
  const [directMessages,setDirectMessages]=useState<DirectMessage[]>([]);
  const [selectedMood,setSelectedMood]=useState<Mood|null>(null);
  const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);
  const [installDismissed,setInstallDismissed]=useState(()=>sessionStorage.getItem('junyu-install-dismissed')==='1');
  const [gamificationTab,setGamificationTab]=useState<GamificationTab>('achievements');
  const [achievementCategory,setAchievementCategory]=useState<AchievementCategory>('all');
  const [loginStreak,setLoginStreak]=useState(1);

  async function api(path:string,method='GET',body?:unknown){
    if(!user)throw Error('請先登入。');
    const response=await fetch(path,{method,headers:{Authorization:`Bearer ${await user.getIdToken()}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const data=await readJson(response);if(!response.ok)throw Error(data.error||'服務暫時無法使用。');return data;
  }
  async function loadTasks(){try{const data=await api('/api/tasks');setTasks(data.tasks);}catch(error){setMessage(error instanceof Error?error.message:'讀取工作失敗。');}}
  async function loadDashboard(){try{setDashboard(await api('/api/dashboard'));}catch(error){setMessage(error instanceof Error?error.message:'讀取團隊工作台失敗。');}}
  async function loadChatPeople(){try{const data=await api('/api/dashboard/people');setChatPeople(data.people);}catch(error){setMessage(error instanceof Error?error.message:'讀取公司人員失敗。');}}
  async function loadDirectMessages(email:string){try{const data=await api(`/api/dashboard/direct/${encodeURIComponent(email)}`);setDirectMessages(data.messages);}catch(error){setMessage(error instanceof Error?error.message:'讀取私訊失敗。');}}

  useEffect(()=>{void(async()=>{try{const response=await fetch('/api/firebase-config',{cache:'no-store'});const config=await response.json();if(!Object.values(config).every(Boolean))throw Error();setAuth(getAuth(initializeApp(config)));}catch{setMessage('Google 登入尚未設定。');setChecking(false);}})();},[]);
  useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,current=>{setUser(current);setEmployee(null);setTasks([]);setChecking(!!current);setMessage(current?'正在載入您的工作空間…':'請使用已建檔且啟用的 Google 帳號登入。');});},[auth]);
  useEffect(()=>{if(!user)return;void(async()=>{try{const response=await fetch('/api/me',{headers:{Authorization:`Bearer ${await user.getIdToken()}`}});const data=await readJson(response);if(!response.ok)throw Error(data.error);setEmployee(data.employee);setMessage('個人工作空間已同步');}catch(error){setMessage(error instanceof Error?error.message:'登入驗證失敗。');}finally{setChecking(false);}})();},[user]);
  useEffect(()=>{if(employee){void loadTasks();void loadDashboard();void loadChatPeople();}},[employee]);
  useEffect(()=>{if(!employee)return;const timer=window.setInterval(()=>{void loadChatPeople();if(selectedChatEmail)void loadDirectMessages(selectedChatEmail);else void loadDashboard();},45000);return()=>window.clearInterval(timer);},[employee,selectedChatEmail]);
  useEffect(()=>{
    let active=true;
    const loadWeather=async(latitude:number,longitude:number,fallbackName:string)=>{
      try{
        const weatherRequest=fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`).then(response=>response.json());
        const locationRequest=fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`).then(response=>response.json()).catch(()=>null);
        const [data,place]=await Promise.all([weatherRequest,locationRequest]);
        if(!active)return;
        setWeather({temperature:Math.round(data.current.temperature_2m),humidity:data.current.relative_humidity_2m,wind:Math.round(data.current.wind_speed_10m),code:data.current.weather_code});
        setWeatherLocation(place?.locality||place?.city||place?.principalSubdivision||fallbackName);
      }catch{if(active){setWeather(null);setWeatherLocation(fallbackName);}}
    };
    const useDefault=()=>void loadWeather(25.033,121.5654,'台北市（預設）');
    if(!navigator.geolocation){useDefault();return()=>{active=false;};}
    navigator.geolocation.getCurrentPosition(
      position=>void loadWeather(position.coords.latitude,position.coords.longitude,'目前位置'),
      useDefault,
      {enableHighAccuracy:false,timeout:8000,maximumAge:600000},
    );
    return()=>{active=false;};
  },[]);
  useEffect(()=>{if(!modal)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)setModal(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[modal,busy]);
  useEffect(()=>{if(!employee)return;const saved=localStorage.getItem(`junyu-card-order:${employee.email}`);if(!saved){setCardOrder(defaultCardOrder);return;}try{const order=JSON.parse(saved) as CardId[];const valid=order.filter(id=>defaultCardOrder.includes(id));setCardOrder([...valid,...defaultCardOrder.filter(id=>!valid.includes(id))]);}catch{setCardOrder(defaultCardOrder);}},[employee]);
  useEffect(()=>{if(!employee)return;const key=`junyu-login-days:${employee.email}`;let days:string[]=[];try{days=JSON.parse(localStorage.getItem(key)||'[]');}catch{days=[];}const current=today();days=[...new Set([...days,current])].sort().slice(-60);localStorage.setItem(key,JSON.stringify(days));let streak=0;const cursor=new Date(`${current}T12:00:00`);while(days.includes(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(cursor))){streak+=1;cursor.setDate(cursor.getDate()-1);}setLoginStreak(Math.max(1,streak));},[employee]);
  useEffect(()=>{const apply=()=>{const dark=theme==='dark'||(theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';};apply();localStorage.setItem('junyu-theme',theme);const media=matchMedia('(prefers-color-scheme: dark)');media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[theme]);
  useEffect(()=>{if('serviceWorker'in navigator)void navigator.serviceWorker.register('/sw.js');const capture=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPromptEvent)};window.addEventListener('beforeinstallprompt',capture);return()=>window.removeEventListener('beforeinstallprompt',capture);},[]);

  const visible=useMemo(()=>tasks.filter(task=>`${task.title} ${task.notes}`.toLowerCase().includes(query.toLowerCase())),[tasks,query]);
  const counts={todo:tasks.filter(t=>t.status==='todo').length,doing:tasks.filter(t=>t.status==='doing').length,done:tasks.filter(t=>t.status==='done').length};
  const completion=tasks.length?Math.round(counts.done/tasks.length*100):0;
  const personalChats=dashboard.chats.filter(item=>item.authorEmail===employee?.email).length;
  const hasCustomLayout=cardOrder.join(',')!==defaultCardOrder.join(',');
  const basePoints=10+tasks.length*10+counts.done*50+counts.doing*15+personalChats*5+(selectedMood?10:0);
  const achievements=[
    {id:'welcome',icon:'🎉',title:'歡迎加入！',description:'完成第一次登入',points:10,category:'milestones' as AchievementCategory,unlocked:true,progress:'已解鎖'},
    {id:'tasks',icon:'🏆',title:'任務大師',description:'完成 10 項任務',points:50,category:'productivity' as AchievementCategory,unlocked:counts.done>=10,progress:`${Math.min(counts.done,10)} / 10`},
    {id:'focus',icon:'🎯',title:'專注行動',description:'同時推進 5 項工作',points:30,category:'productivity' as AchievementCategory,unlocked:counts.doing>=5,progress:`${Math.min(counts.doing,5)} / 5`},
    {id:'team',icon:'👥',title:'團隊夥伴',description:'在員工聊天室留言 10 次',points:40,category:'collaboration' as AchievementCategory,unlocked:personalChats>=10,progress:`${Math.min(personalChats,10)} / 10`},
    {id:'early',icon:'🌅',title:'早起鳥',description:'上午 8 點前登入工作台',points:20,category:'milestones' as AchievementCategory,unlocked:new Date().getHours()<8,progress:new Date().getHours()<8?'已解鎖':'未解鎖'},
    {id:'streak',icon:'🔥',title:'一週連勝',description:'連續登入 7 天',points:100,category:'milestones' as AchievementCategory,unlocked:loginStreak>=7,progress:`${Math.min(loginStreak,7)} / 7 天`},
    {id:'dashboard',icon:'🎛️',title:'工作台大師',description:'自訂卡片排列順序',points:25,category:'learning' as AchievementCategory,unlocked:hasCustomLayout,progress:hasCustomLayout?'已解鎖':'拖曳卡片解鎖'},
    {id:'communicator',icon:'💬',title:'溝通高手',description:'在員工聊天室留言 50 次',points:60,category:'collaboration' as AchievementCategory,unlocked:personalChats>=50,progress:`${Math.min(personalChats,50)} / 50`},
  ];
  const unlockedAchievements=achievements.filter(item=>item.unlocked);
  const points=basePoints+unlockedAchievements.filter(item=>item.id!=='welcome').reduce((sum,item)=>sum+item.points,0);
  const level=Math.max(1,Math.floor(points/250)+1);
  const badges=unlockedAchievements.length;
  const levelProgress=points%250;
  const filteredAchievements=achievements.filter(item=>achievementCategory==='all'||item.category===achievementCategory);
  const leaderboard=(()=>{const people=new Map<string,{email:string;name:string;points:number}>();for(const item of dashboard.activities){const current=people.get(item.actorEmail)||{email:item.actorEmail,name:item.actorName,points:0};current.points+=item.kind==='task'?50:item.kind==='mood'?10:5;people.set(item.actorEmail,current);}if(employee)people.set(employee.email,{email:employee.email,name:employee.name,points:Math.max(points,people.get(employee.email)?.points||0)});return [...people.values()].sort((a,b)=>b.points-a.points).slice(0,10);})();
  const selectedChatPerson=chatPeople.find(person=>person.email===selectedChatEmail);
  const activeMessages=selectedChatEmail?directMessages:dashboard.chats;

  async function login(){if(!auth)return;setMessage('正在開啟 Google 登入…');try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);}catch{setMessage('Google 登入未完成，請重新嘗試。');}}
  async function createTask(event:FormEvent){event.preventDefault();setBusy(true);try{await api('/api/tasks','POST',form);setModal(false);setForm(emptyTask());setMessage('工作已建立並同步。');await Promise.all([loadTasks(),loadDashboard()]);}catch(error){setMessage(error instanceof Error?error.message:'新增工作失敗。');}finally{setBusy(false);}}
  async function advance(task:Task){setBusy(true);try{await api(`/api/tasks/${task.id}`,'PATCH',{version:task.version,status:nextStatus[task.status]});await loadTasks();}catch(error){setMessage(error instanceof Error?error.message:'更新工作失敗。');}finally{setBusy(false);}}
  async function checkMood(mood:Mood){setSelectedMood(mood);setBusy(true);try{setDashboard(await api('/api/dashboard/mood','POST',{mood}));setMessage('今日心情已送出。');}catch(error){setMessage(error instanceof Error?error.message:'心情報到失敗。');}finally{setBusy(false);}}
  async function sendMessage(event:FormEvent){event.preventDefault();if(!chatText.trim())return;setBusy(true);try{if(selectedChatEmail){await api(`/api/dashboard/direct/${encodeURIComponent(selectedChatEmail)}`,'POST',{text:chatText});await loadDirectMessages(selectedChatEmail);}else setDashboard(await api('/api/dashboard/chat','POST',{text:chatText}));setChatText('');}catch(error){setMessage(error instanceof Error?error.message:'訊息傳送失敗。');}finally{setBusy(false);}}
  function openConversation(email:string|null){setSelectedChatEmail(email);setChatText('');if(email)void loadDirectMessages(email);}
  function startCardDrag(event:DragEvent<HTMLElement>,id:CardId){setDraggingCard(id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);}
  function dropCard(event:DragEvent<HTMLElement>,target:CardId){event.preventDefault();const source=(draggingCard||event.dataTransfer.getData('text/plain')) as CardId;if(!source||source===target){setDraggingCard(null);return;}setCardOrder(order=>{const next=order.filter(id=>id!==source);next.splice(next.indexOf(target),0,source);if(employee)localStorage.setItem(`junyu-card-order:${employee.email}`,JSON.stringify(next));return next;});setDraggingCard(null);}
  async function installApp(){if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null);}else setMessage('請從瀏覽器選單選擇「安裝應用程式」或「新增至主畫面」。');}
  async function enableNotifications(){if(!('Notification'in window)){setMessage('此瀏覽器不支援通知。');return;}const permission=await Notification.requestPermission();setMessage(permission==='granted'?'通知已啟用。':'通知尚未啟用。');}
  function dismissInstall(){sessionStorage.setItem('junyu-install-dismissed','1');setInstallDismissed(true);}

  if(!employee)return <div className="login-page"><div className="login-glow one"/><div className="login-glow two"/><section className="login-card"><div className="login-brand"><span>J</span><div><b>君宇集團</b><small>JUNYU GROUP</small></div></div><p className="eyebrow">NEXUS EMPLOYEE WORKSPACE</p><h1>員工工作入口</h1><p className="login-copy">將個人任務、會議與公司服務集中在一個現代化工作台。</p><div className="login-status"><ShieldCheck size={18}/>{message}</div>{!user?<button className="primary large" disabled={!auth||checking} onClick={login}>使用 Google 帳號登入<ChevronRight size={18}/></button>:!checking&&<button onClick={()=>auth&&signOut(auth)}>切換 Google 帳號</button>}<small className="login-note">僅限公司名冊中已建檔並啟用的帳號</small></section></div>;

  const cardProps=(id:CardId)=>({key:id,draggable:true,onDragStart:(event:DragEvent<HTMLElement>)=>startCardDrag(event,id),onDragOver:(event:DragEvent<HTMLElement>)=>{event.preventDefault();event.dataTransfer.dropEffect='move';},onDrop:(event:DragEvent<HTMLElement>)=>dropCard(event,id),onDragEnd:()=>setDraggingCard(null),className:`panel dashboard-card ${id}-card ${draggingCard===id?'is-dragging':''}`});
  const dragButton=<button className="drag-handle" aria-label="拖曳卡片調整順序" title="拖曳卡片調整順序"><GripVertical/></button>;

  return <div className="portal-shell">
    <header className="topbar"><div className="topbar-inner"><div className="app-brand"><span>J</span><div><b>君宇集團</b><small>Employee Workspace</small></div></div><div className="search"><Search/><input aria-label="搜尋工作" placeholder="搜尋人員、任務與服務…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="theme-switch"><button className={theme==='light'?'active':''} onClick={()=>setTheme('light')}><SunMedium/>淺色</button><button className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')}><Moon/>深色</button><button className={theme==='system'?'active':''} onClick={()=>setTheme('system')}><Monitor/>系統</button></div><button className="notice" title="通知"><Bell/></button><div className="user-menu"><div className="avatar">{employee.name.slice(0,1)}</div><span><b>{employee.name}</b><small>{employee.jobTitle||'員工'}</small></span><button title="登出" onClick={()=>auth&&signOut(auth)}><LogOut/></button></div></div></header>
    <main className="portal-main"><div className="page-content">
      <section className="welcome"><div><p>早安</p><h1>{employee.name} <span>👋</span></h1><div>這是您的團隊概況與個人工作台，今天也一起完成重要工作。</div></div><button className="hero-action" onClick={()=>setModal(true)}><Plus/>建立工作</button></section>
      <div className="dashboard-heading"><div><h2>工作總覽</h2><p>今天的工作、行程與公司服務一覽</p></div><span><GripVertical/> 拖曳卡片調整順序</span></div>
      <section className="dashboard-grid">{cardOrder.map(id=>{
        if(id==='stats')return <article {...cardProps(id)}><div className="card-title"><span className="icon-box blue"><BarChart3/></span><h3>我的統計</h3>{dragButton}</div><div className="mini-stats"><div className="amber"><span className="stat-emoji">⚡</span><strong>{level}</strong><span>等級</span></div><div className="blue"><span className="stat-emoji">✨</span><strong>{points}</strong><span>積分</span></div><div className="green"><span className="stat-emoji">🏆</span><strong>{badges}</strong><span>徽章</span></div></div></article>;
        if(id==='schedule')return <article {...cardProps(id)}><div className="card-title"><span className="icon-box amber"><CalendarDays/></span><h3>今日行程</h3><small>會議維護中</small>{dragButton}</div><div className="schedule-list"><div className="blue"><b>工作規劃</b><span>09:00</span></div><div className="amber"><b>進度確認</b><span>14:00</span></div><div className="rose"><b>每日整理</b><span>16:30</span></div></div></article>;
        if(id==='tasks')return <article {...cardProps(id)}><div className="card-title"><span className="icon-box green"><Check/></span><h3>我的任務</h3><button onClick={()=>setModal(true)} aria-label="新增工作"><Plus/></button>{dragButton}</div>{visible.length?<div className="compact-tasks">{visible.slice(0,3).map(task=><button key={task.id} className={`compact-task ${task.status}`} disabled={busy} onClick={()=>void advance(task)}><span className="task-check">{task.status==='done'?<Check/>:task.status==='doing'?<Clock3/>:null}</span><b>{task.title}</b><i className={task.priority}/></button>)}<small>{counts.done}/{tasks.length} 已完成</small></div>:<button className="empty-compact" onClick={()=>setModal(true)}><Plus/><b>建立第一項工作</b><span>工作會與您的帳號同步</span></button>}</article>;
        if(id==='quick')return <article {...cardProps(id)}><div className="card-title"><span className="icon-box violet"><Sparkles/></span><h3>快速操作</h3>{dragButton}</div><div className="quick-list"><button onClick={()=>setModal(true)}><span className="blue"><Plus/></span><b>建立工作<small>新增個人待辦事項</small></b></button><button disabled><span className="amber"><CalendarDays/></span><b>會議預約<small>服務目前維護中</small></b></button>{employee.email==='jet@gotofunapp.com'&&<a href="https://takeway-company.ai.studio/"><span className="green"><Settings/></span><b>人員管理<small>開啟公司名冊後台</small></b></a>}</div></article>;
        if(id==='weather')return <article {...cardProps(id)}><div className="card-title"><span className="icon-box amber"><CloudSun/></span><h3>當地天氣</h3>{dragButton}</div><div className="weather-card"><div className="weather-symbol">{weather&&weather.code>2?'🌥️':'☀️'}</div><strong>{weather?`${weather.temperature}°C`:'--'}</strong><span>{weather?'目前天氣':'載入中'}</span><div><small>💧 {weather?.humidity??'--'}%</small><small>🌬️ {weather?.wind??'--'} km/h</small></div><p>{weatherLocation}</p></div></article>;
        if(id==='profile')return <article {...cardProps(id)}><div className="card-title"><span className="icon-box cyan"><Users/></span><h3>我的資料</h3>{dragButton}</div><div className="profile-hero"><div className="avatar large">{employee.name.slice(0,1)}</div><div><b>{employee.name}</b><span>{employee.unit||'君宇集團'} · {employee.jobTitle||'員工'}</span></div></div><dl><div><dt>工號</dt><dd>{employee.employeeId||'未設定'}</dd></div><div><dt>部門代碼</dt><dd>{employee.departmentCode||'未設定'}</dd></div><div><dt>Google 帳號</dt><dd>{employee.email}</dd></div></dl></article>;
        if(id==='news')return <article {...cardProps(id)}><div className="card-title"><span className="icon-box rose"><Newspaper/></span><h3>公司公告</h3>{dragButton}</div><div className="news-list"><div><span/><b>員工工作入口已啟用</b><small>系統 · 今日</small></div><div><span/><b>會議預約系統維護中</b><small>行政 · 更新中</small></div><div><span/><b>Nexus 個人工作台上線</b><small>資訊 · {message}</small></div></div></article>;
        return <article {...cardProps(id)}><div className="card-title"><span className="icon-box violet"><BarChart3/></span><h3>工作分析</h3>{dragButton}</div><div className="analytics-card"><div><span>工作完成率</span><b>{completion}%</b></div><div className="progress"><i style={{width:`${completion}%`}}/></div><section><div><strong>{counts.done}</strong><span>已完成</span></div><div><strong>{counts.doing}</strong><span>進行中</span></div><div><strong>{counts.todo}</strong><span>待處理</span></div></section></div></article>;
      })}</section>

      <section className="team-grid"><article className="panel team-pulse"><div className="section-title"><span className="icon-box rose"><HeartPulse/></span><div><h3>團隊心情</h3><p>今天大家感覺如何？已有 {dashboard.checkins} 人完成報到</p></div></div><div className="mood-summary">{moodOptions.map(item=><span key={item.id}>{item.emoji} <b>{dashboard.moodCounts[item.id]}</b></span>)}</div><div className="mood-question"><b>你今天感覺如何？</b><div>{moodOptions.map(item=><button key={item.id} className={selectedMood===item.id?'selected':''} disabled={busy} onClick={()=>void checkMood(item.id)}><span>{item.emoji}</span>{item.label}</button>)}</div></div></article><article className="panel activity-panel"><div className="section-title"><span className="icon-box amber"><Activity/></span><div><h3>團隊動態</h3><p><i/> 即時更新</p></div></div><div className="activity-list">{dashboard.activities.length?dashboard.activities.slice(0,8).map(item=><div key={item.id}><span className="activity-avatar">{item.actorName.slice(0,1)}</span><p><b>{item.actorName}</b> {item.text}<small>{timeLabel(item.createdAt)}</small></p></div>):<div className="section-empty">完成工作、心情報到或留言後，動態會顯示在這裡。</div>}</div></article></section>
      <section className="social-grid"><article className="panel chat-panel"><div className="section-title"><span className="icon-box blue"><MessageCircle/></span><div><h3>員工聊天室</h3><p>{selectedChatPerson?`與 ${selectedChatPerson.name} 私訊`:'#general · 公司帳號限定'}</p></div><span className="online-count"><i/> {chatPeople.filter(person=>person.online).length} 人在線</span></div><div className="chat-workspace"><aside className="chat-people"><button className={!selectedChatEmail?'active':''} onClick={()=>openConversation(null)}><span className="general-avatar">#</span><p><b>公開聊天室</b><small>所有公司人員</small></p></button><h4>公司人員 <small>{chatPeople.filter(person=>person.email!==employee.email).length}</small></h4><div>{chatPeople.filter(person=>person.email!==employee.email).map(person=><button key={person.email} className={selectedChatEmail===person.email?'active':''} onClick={()=>openConversation(person.email)}><span className="person-avatar">{person.name.slice(0,1)}<i className={person.online?'online':''}/></span><p><b>{person.name}</b><small>{person.online?'在線':'離線'}</small></p></button>)}</div></aside><div className="chat-conversation"><div className="conversation-head"><span>{selectedChatPerson?.name||'公開聊天室'}</span><small>{selectedChatPerson?(selectedChatPerson.online?'● 在線':'離線'):'所有已啟用帳號皆可查看'}</small></div><div className="chat-list">{activeMessages.length?activeMessages.slice(-20).map(item=><div key={item.id} className={item.authorEmail===employee.email?'mine':''}><span>{item.authorName.slice(0,1)}</span><p><b>{item.authorName}<small>{timeLabel(item.createdAt)}</small></b>{item.text}</p></div>):<div className="section-empty">{selectedChatEmail?'目前尚無私訊，傳送第一則訊息。':'目前尚無訊息，成為第一個留言的人。'}</div>}</div><form className="chat-form" onSubmit={sendMessage}><input maxLength={300} value={chatText} onChange={e=>setChatText(e.target.value)} placeholder={selectedChatPerson?`傳訊息給 ${selectedChatPerson.name}…`:'輸入公開訊息…'} aria-label="聊天室訊息"/><button disabled={busy||!chatText.trim()}><Send/></button></form></div></div></article><article className="panel gamification-panel"><div className="gamification-head"><div className="section-title"><span className="icon-box violet">🎮</span><div><h3>Gamification</h3><p>完成工作、持續登入並參與團隊互動</p></div></div><div className="game-tabs"><button className={gamificationTab==='achievements'?'active':''} onClick={()=>setGamificationTab('achievements')}>🏆 成就</button><button className={gamificationTab==='leaderboard'?'active':''} onClick={()=>setGamificationTab('leaderboard')}>👑 排行榜</button></div></div>{gamificationTab==='achievements'?<><div className="game-summary"><div><span>{badges} / {achievements.length}</span><small>已解鎖</small></div><div><span>{level}</span><small>等級</small></div><div><span>{points}</span><small>積分</small></div><div className="streak"><span>🔥 {loginStreak}</span><small>連續天數</small></div></div><div className="level-progress"><span style={{width:`${levelProgress/2.5}%`}}/><small>距離等級 {level+1} 還差 {250-levelProgress} 分</small></div><div className="achievement-filters"><button className={achievementCategory==='all'?'active':''} onClick={()=>setAchievementCategory('all')}>🏆 全部</button><button className={achievementCategory==='productivity'?'active':''} onClick={()=>setAchievementCategory('productivity')}>📈 生產力</button><button className={achievementCategory==='collaboration'?'active':''} onClick={()=>setAchievementCategory('collaboration')}>👥 協作</button><button className={achievementCategory==='learning'?'active':''} onClick={()=>setAchievementCategory('learning')}>📚 學習</button><button className={achievementCategory==='milestones'?'active':''} onClick={()=>setAchievementCategory('milestones')}>🎯 里程碑</button></div><div className="achievement-grid">{filteredAchievements.map(item=><div key={item.id} className={item.unlocked?'unlocked':''}><span className="achievement-icon">{item.icon}</span><div><h4>{item.title}</h4><p>{item.description}</p><small>{item.progress}</small></div><b>{item.points}<small> 分</small></b>{item.unlocked&&<i><Check/></i>}</div>)}</div></>:<div className="leaderboard"><div className="leaderboard-title"><h4>團隊排行榜</h4><span>依實際工作與互動積分</span></div>{leaderboard.map((person,index)=><div key={person.email} className={person.email===employee.email?'me':''}><span className="rank">{index<3?['🥇','🥈','🥉'][index]:index+1}</span><span className="leader-avatar">{person.name.slice(0,1)}</span><p><b>{person.name}</b><small>{person.email===employee.email?'這是您':'團隊成員'}</small></p><strong>{person.points}<small> 分</small></strong></div>)}</div>}</article></section>
      <section className="panel full-tasks"><div className="panel-head"><div><p className="eyebrow">MY WORK</p><h2>全部任務</h2></div><button className="text-button" onClick={()=>setModal(true)}><Plus/>新增工作</button></div>{visible.length?<div className="task-list">{visible.slice(0,8).map(task=><button key={task.id} className={`task-row ${task.status}`} disabled={busy} onClick={()=>void advance(task)}><span className="task-check">{task.status==='done'?<Check/>:task.status==='doing'?<Clock3/>:null}</span><span className="task-copy"><b>{task.title}</b><small>{task.notes||'沒有補充說明'} · 到期 {task.dueDate}</small></span><span className={`priority ${task.priority}`}>{task.priority==='high'?'高':task.priority==='low'?'低':'一般'}</span><span className="task-status">{statusLabel[task.status]}</span></button>)}</div>:<div className="empty"><BriefcaseBusiness/><h3>目前沒有工作</h3><p>按「建立工作」新增第一項實際任務。</p></div>}</section>
    </div></main>
    {!installDismissed&&!matchMedia('(display-mode: standalone)').matches&&<aside className="install-banner"><span><Download/></span><div><b>安裝君宇集團</b><small>加入桌面或主畫面，快速開啟員工工作台</small></div><button className="install-primary" onClick={()=>void installApp()}>安裝</button><button className="notification-button" onClick={()=>void enableNotifications()}>啟用通知</button><button className="dismiss-button" onClick={dismissInstall}>關閉</button></aside>}
    {modal&&<div className="modal-backdrop"><form className="task-modal" onSubmit={createTask}><div className="modal-head"><div><p className="eyebrow">NEW TASK</p><h2>建立工作</h2></div><button type="button" aria-label="關閉" onClick={()=>setModal(false)}><X/></button></div><label>工作名稱<input autoFocus required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例如：完成設備盤點"/></label><label>補充說明<textarea maxLength={1000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="工作內容、交付標準或備註"/></label><div className="form-row"><label>到期日<input required type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label><label>優先程度<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Task['priority']})}><option value="low">低</option><option value="normal">一般</option><option value="high">高</option></select></label></div><div className="modal-actions"><button type="button" onClick={()=>setModal(false)}>取消</button><button className="primary" disabled={busy}>{busy?'建立中…':'建立工作'}</button></div></form></div>}
  </div>;
}
