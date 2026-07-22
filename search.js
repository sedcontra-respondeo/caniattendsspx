(function () {
  "use strict";
  var input = document.getElementById("search-input");
  var status = document.getElementById("search-status");
  var results = document.getElementById("search-results");
  var form = document.getElementById("search-form");

  var index = null;
  var indexFailed = false;

  fetch("search-index.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      index = data;
      var q = new URLSearchParams(location.search).get("q");
      if (q) {
        input.value = q;
        runSearch(q);
      }
    })
    .catch(function () {
      indexFailed = true;
      status.textContent = "Search index failed to load. Try reloading the page.";
    });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function snippet(text, words) {
    var lower = text.toLowerCase();
    var pos = -1;
    for (var i = 0; i < words.length; i++) {
      var idx = lower.indexOf(words[i]);
      if (idx !== -1 && (pos === -1 || idx < pos)) pos = idx;
    }
    var start = Math.max(0, (pos === -1 ? 0 : pos) - 60);
    var end = Math.min(text.length, start + 220);
    var out = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    out = escapeHtml(out);
    for (var j = 0; j < words.length; j++) {
      if (!words[j]) continue;
      var re = new RegExp("(" + escapeRegex(words[j]) + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    }
    return out;
  }

  function runSearch(query) {
    var q = query.trim();
    var params = new URLSearchParams(location.search);
    if (q) params.set("q", q); else params.delete("q");
    var qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));

    results.innerHTML = "";

    if (!q) {
      status.textContent = "Enter a word or phrase to search the whole work.";
      return;
    }
    if (!index) {
      status.textContent = indexFailed ? "Search index failed to load." : "Loading search index…";
      return;
    }

    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    var scored = [];
    for (var i = 0; i < index.length; i++) {
      var entry = index[i];
      var headingLower = (entry.heading || "").toLowerCase();
      var textLower = entry.text.toLowerCase();
      var score = 0;
      for (var w = 0; w < words.length; w++) {
        var word = words[w];
        if (headingLower.indexOf(word) !== -1) score += 3;
        var count = textLower.split(word).length - 1;
        score += Math.min(count, 5);
      }
      if (score > 0) scored.push({ entry: entry, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    var top = scored.slice(0, 40);

    if (top.length === 0) {
      status.textContent = "No results found for “" + q + "”.";
      return;
    }
    status.textContent = top.length + " result" + (top.length === 1 ? "" : "s") +
      " for “" + q + "”" +
      (scored.length > top.length ? " (showing top " + top.length + ")" : "") + ".";

    var frag = document.createDocumentFragment();
    for (var k = 0; k < top.length; k++) {
      var e = top[k].entry;
      var li = document.createElement("li");
      li.className = "search-result";
      var titleText = e.heading || e.page;
      var context = e.heading ? e.page : null;
      li.innerHTML =
        (context ? '<p class="search-result-context">' + escapeHtml(context) + "</p>" : "") +
        '<p class="search-result-title"><a href="' + escapeHtml(e.url) + '">' + escapeHtml(titleText) + "</a></p>" +
        '<p class="search-result-snippet">' + snippet(e.text, words) + "</p>";
      frag.appendChild(li);
    }
    results.appendChild(frag);
  }

  var debounceTimer;
  input.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { runSearch(input.value); }, 150);
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearTimeout(debounceTimer);
    runSearch(input.value);
  });

  input.focus();
})();
