"use client";

import { useEffect, useState } from "react";

export default function PwaInstall() {
  const [installPrompt,setInstallPrompt]=useState(null);
  const [showGuide,setShowGuide]=useState(false);
  const [isIOS,setIsIOS]=useState(false);
  const [installed,setInstalled]=useState(false);

  useEffect(()=>{
    const ua=window.navigator.userAgent||"";
    const ios=/iPad|iPhone|iPod/.test(ua)||(ua.includes("Mac")&&"ontouchend" in document);
    const standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
    setIsIOS(ios);
    setInstalled(standalone);
    if(standalone)return;
    const capture=e=>{e.preventDefault();setInstallPrompt(e);};
    const done=()=>{setInstalled(true);setShowGuide(false);setInstallPrompt(null);};
    window.addEventListener("beforeinstallprompt",capture);
    window.addEventListener("appinstalled",done);
    if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
    return ()=>{window.removeEventListener("beforeinstallprompt",capture);window.removeEventListener("appinstalled",done);};
  },[]);

  async function install(){
    if(installPrompt){
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    setShowGuide(true);
  }

  if(installed)return null;
  return <div className="pwa-install-wrap">
    {showGuide&&<div className="pwa-install-guide" role="dialog" aria-label="Install NFL Vegas Tracker">
      <button className="pwa-guide-close" onClick={()=>setShowGuide(false)} aria-label="Close">×</button>
      <strong>Add NFL Vegas Tracker to your Home Screen</strong>
      {isIOS?<ol><li>Tap the <b>Share</b> button in Safari.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b> to finish.</li></ol>:<p>Open your browser menu and choose <b>Install app</b> or <b>Add to Home Screen</b>.</p>}
      <small>It will open in its own app window.</small>
    </div>}
    <button className="pwa-install-button" onClick={install}>
      <span aria-hidden="true">↓</span> Install App
    </button>
  </div>;
}
