(function(){
  'use strict';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- THEME ---------- */
  var root = document.documentElement;
  var toggleBtn = document.getElementById('themeToggle');
  var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  root.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
  toggleBtn.addEventListener('click', function(){
    var cur = root.getAttribute('data-theme');
    root.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
    requestAnimationFrame(buildPath);
  });

  /* ---------- ACCORDION ---------- */
  document.querySelectorAll('.station-toggle').forEach(function(btn){
    btn.addEventListener('click', function(){
      var panel = btn.nextElementSibling;
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      if(expanded){
        panel.style.maxHeight = '0px';
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
      // recompute path after layout settles (station heights affect node positions below)
      setTimeout(buildPath, 420);
    });
  });
  window.addEventListener('resize', function(){
    document.querySelectorAll('.station-toggle[aria-expanded="true"]').forEach(function(btn){
      btn.nextElementSibling.style.maxHeight = btn.nextElementSibling.scrollHeight + 'px';
    });
  });

  /* ---------- REVEAL ON SCROLL ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('in-view'); }
      });
    }, {threshold:0.12});
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in-view'); });
  }

  /* ---------- SIDE RAIL: active state + navigation ---------- */
  var railItems = Array.prototype.slice.call(document.querySelectorAll('.rail-item'));
  var railTargets = {
    hero: document.getElementById('hero'),
    about: document.getElementById('about'),
    'lane-se': document.getElementById('lane-se'),
    'lane-sec': document.getElementById('lane-sec'),
    contact: document.getElementById('contact')
  };
  railItems.forEach(function(item){
    item.addEventListener('click', function(){
      var key = item.getAttribute('data-target');
      var el = railTargets[key];
      if(el){ el.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block: 'start'}); }
    });
  });

  var sectionOrder = ['hero','about','lane-se','lane-sec','contact'];
  function updateActiveRail(){
    var focusTop = window.innerWidth <= 768 ? window.innerHeight * 0.2 : window.innerHeight * 0.26;
    var focusBottom = window.innerWidth <= 768 ? window.innerHeight * 0.72 : window.innerHeight * 0.68;
    var current = 'hero';
    var bestVisible = -1;

    sectionOrder.forEach(function(key){
      var el = railTargets[key];
      if(!el) return;

      var rect = el.getBoundingClientRect();
      var visible = Math.min(rect.bottom, focusBottom) - Math.max(rect.top, focusTop);
      if(visible > bestVisible){
        bestVisible = visible;
        current = key;
      }
    });

    railItems.forEach(function(item){
      item.classList.toggle('active', item.getAttribute('data-target') === current);
    });
  }

  /* ---------- SPINE PATH + AVATAR ---------- */
  var svg = document.getElementById('spine-svg');
  var pathEl = document.getElementById('spine-path');
  var avatar = document.getElementById('avatar');
  var spineLayer = document.getElementById('spine-layer');
  var nodeIds = ['anchor-hero','anchor-about','anchor-edu','anchor-lane-se','anchor-lane-sec','anchor-contact'];
  var pathLength = 0;
  var waypoints = [];

  function vec(p1,p2){ return {x:p2.x-p1.x, y:p2.y-p1.y}; }
  function dist(p1,p2){ return Math.hypot(p2.x-p1.x, p2.y-p1.y); }
  function norm(v){ var l=Math.hypot(v.x,v.y)||1; return {x:v.x/l, y:v.y/l}; }

  function buildRoundedPath(points, radius){
    if(points.length < 2) return '';
    var d = 'M ' + points[0].x + ' ' + points[0].y;
    for(var i=1; i<points.length-1; i++){
      var p0=points[i-1], p1=points[i], p2=points[i+1];
      var v1 = norm(vec(p1,p0));
      var v2 = norm(vec(p1,p2));
      var d1 = Math.min(radius, dist(p0,p1)/2);
      var d2 = Math.min(radius, dist(p2,p1)/2);
      var start = {x:p1.x+v1.x*d1, y:p1.y+v1.y*d1};
      var end = {x:p1.x+v2.x*d2, y:p1.y+v2.y*d2};
      d += ' L ' + start.x + ' ' + start.y + ' Q ' + p1.x + ' ' + p1.y + ' ' + end.x + ' ' + end.y;
    }
    var last = points[points.length-1];
    d += ' L ' + last.x + ' ' + last.y;
    return d;
  }

  function getCenter(el){
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width/2 + window.scrollX, y: r.top + r.height/2 + window.scrollY };
  }

  function buildPath(){
    var docHeight = document.body.scrollHeight;
    svg.setAttribute('height', docHeight);
    spineLayer.style.height = docHeight + 'px';

    waypoints = nodeIds.map(function(id){
      var el = document.getElementById(id);
      return el ? getCenter(el) : null;
    }).filter(Boolean);

    // gentle horizontal offsets so the line doesn't sit perfectly straight (roadmap feel)
    if(waypoints.length >= 6){
      waypoints[3].x -= 46; // lane-se anchor nudges left
      waypoints[4].x += 46; // lane-sec anchor nudges right
    }

    var d = buildRoundedPath(waypoints, 60);
    pathEl.setAttribute('d', d);
    pathLength = pathEl.getTotalLength();

    var first = waypoints[0], last = waypoints[waypoints.length-1];
    pathBounds = { top: first.y, bottom: last.y };

    positionAvatar();
  }

  var pathBounds = {top:0, bottom:1};

  function positionAvatar(){
    if(!pathLength) return;
    var scrollCenter = window.scrollY + window.innerHeight * 0.42;
    var range = Math.max(1, pathBounds.bottom - pathBounds.top);
    var progress = (scrollCenter - pathBounds.top) / range;
    progress = Math.max(0, Math.min(1, progress));
    var pt = pathEl.getPointAtLength(progress * pathLength);
    avatar.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px) translate(-50%,-50%)';

    // color the avatar based on which lane it's currently traveling through
    var laneSecEl = document.getElementById('lane-sec');
    var laneSecTop = laneSecEl ? laneSecEl.offsetTop - window.innerHeight*0.3 : Infinity;
    avatar.classList.toggle('lane-sec', scrollCenter >= laneSecTop);
  }

  var ticking = false;
  function onScroll(){
    if(!ticking){
      requestAnimationFrame(function(){
        positionAvatar();
        updateActiveRail();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', function(){
    clearTimeout(window.__rt);
    window.__rt = setTimeout(buildPath, 200);
  });

  window.addEventListener('load', function(){
    setTimeout(buildPath, 150);
    updateActiveRail();
  });
  document.fonts && document.fonts.ready.then(function(){ setTimeout(buildPath, 100); });
  buildPath();
})();
