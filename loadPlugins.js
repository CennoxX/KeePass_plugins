import { DOMParser } from "jsr:@b-fuze/deno-dom";
var source = await fetch("https://keepass.info/plugins.html");
var sourceText = await source.text();
var doc = new DOMParser().parseFromString(sourceText, "text/html");
var plgs = [...doc.querySelectorAll(".tablebox")].filter(i => i.querySelector('img[alt="2.x"]') && i.getAttribute("id") != "testplugin" && !i.getAttribute("id").startsWith("convertto")).flatMap(i => {
	var el;
	var extMeta = i.querySelector(".extmeta");
	var group = (el = doc.querySelector(`[href="#${i.getAttribute("id")}"]`)) && (() => { while (el && !el.classList.contains('extindexgroup')) el = el.previousElementSibling; return el; })().innerText;
	var description = i.querySelector("td").innerText.replace(extMeta?.innerText,"").replace(/\n\n+/g,"\n\n").trim();
	var idx = description.split("\n").findIndex(str => str.includes('['));
	if (idx != -1)
    	description = description.split("\n").slice(0, idx - 1).join("\n");
	description = description?.replace(/(?<!\n)\n(?!\n)/g, " ").replace(/\n\n/g, "\n").trim();
	if (i.querySelector("ul.withspc")) {
    	return [...i.querySelectorAll("ul.withspc > li")].filter(i => !i.querySelector('[alt="1.x"]'))
		.map(li => {
      var title = li.querySelector("b,strong")?.innerText.trim();
      var id = i.getAttribute("id") + title.toLowerCase().replace(/\W/g, "");
      var extMeta = li.querySelector(".extmeta");
      var authors = extMeta?.innerText.match(/Authors?:(.*?)\. Language/s)?.[1]?.replace("\n", " ").trim();
      authors = (authors?.match(/\([^,]*\)/) ? authors.match(/\(and /) ? authors.split(/ \(and |\)/) : authors.split(/, /) : authors?.split(/ \(|\)|, /))?.filter(i => i);
      var language = [...(extMeta?.innerHTML.matchAll(/<img[^>]+alt="([^"]+)"/g) || [])].map(match => match?.[1]);
      var website = [...li.childNodes].find(c => c.textContent?.includes("[Website") || c.textContent?.includes("Website]"))?.getAttribute("href");
      var desc = li.innerText.replace(extMeta?.innerText, "").split("\n");
      var idx = desc.findIndex(str => str.includes('['));
      desc = desc.slice(2, idx - 1).join("\n");
      description = desc ? desc : description;
      description = description?.replace(/(?<!\n)\n(?!\n)/g, " ").replace(/\n\n/g, "\n").trim();
      return {id, title, authors, language, website, description, group};
    });
	}
	var id = i.getAttribute("id");
	var title = i.querySelector("th").innerText.trim();
	var shortdescNode = doc.querySelector("[href='#"+i.getAttribute("id")+"']~br");
	var shortdesc = shortdescNode[(shortdescNode.nextSibling.textContent.trim() ? "nextSibling" : "nextElementSibling")]?.textContent.trim();
	var authors = extMeta?.innerText.match(/Authors?:(.*?)\. Language/s)?.[1]?.replace("\n"," ").trim();
	authors = (authors?.match(/\([^,]*\)/) ? authors.match(/\(and /) ? authors.split(/ \(and |\)/) : authors.split(/, /) : authors?.split(/ \(|\)|, /))?.filter(i => i);
	var language = (extMeta? [...extMeta?.innerHTML.matchAll(/<img[^>]+alt="([^"]+)"/g)] : [])?.map(match => match?.[1]);
	var similar = [...i.querySelectorAll("td")].find(i => i.innerHTML.includes("<em>Similar plugin") || i.innerHTML.includes("<em>See also"));
	similar = similar ? [...similar.querySelectorAll("a")].map(i => i.getAttribute("href").split("#").pop()) : [];
	var note = [...i.querySelectorAll("td")].find(i => i.innerHTML.includes("<em>Note") || i.innerHTML.includes(`<em><span style="color: #BB0000;">Warning:`))?.innerText.replace("Note:", "").replace(" Warning: ", "").trim();
	var getLink = (node, text) => {
		var nodes = node.querySelector("td").childNodes;
		var idx = [...nodes].findIndex(c => c.textContent?.includes(text));
		return idx == -1 ? null : nodes[idx + (nodes[idx].tagName ? 0 : 1)].getAttribute("href");
	};
	var sourceCode = getLink(i, "Download source code") || getLink(i, "[Source Code]");
	var download = getLink(i, "Download plugin") || getLink(i, "[Download]");
	var website = getLink(i, "[Website") || getLink(i, "Website]");
	var formatUrl = (url) => url && !url.startsWith("http") ? "https://keepass.info/" + url : url;
	download = formatUrl(download);
	sourceCode = formatUrl(sourceCode);
	website = formatUrl(website);
	var forks = [...i.querySelectorAll("td b")].filter(b => b.innerText.includes("Fork")).map(b => {
    var forkInfo = b.nextSibling?.textContent?.trim().replace("by", "").replace(":", "").trim().split(" (");
    var forkAuthor = forkInfo[0];
    var forkDescription = forkInfo[1] ? "\n" + forkInfo[1].replace(")","") : "";
    var forkWebsite = b.parentElement.querySelector("a")?.getAttribute("href");
    return {
      id: id + "_fork",
      title: title + " (fork)",
      authors: [forkAuthor],
      language,
      description: description + forkDescription,
      note,
      similar,
      group,
      sourceCode: null,
      download: null,
      website: forkWebsite
    };
	});
	return [{id, title, shortdesc, authors, language, description, note, similar, group, sourceCode, download, website}, ...forks]}).filter(i => i.authors);
  
  var pat = Deno.env.get("GITHUB_PAT");
  plgs = await Promise.all(plgs.map(async(p) => {
    var repoUrl = p.website?.includes("github") ? p.website : p.sourceCode?.includes("github") ? p.sourceCode : undefined;
    if (repoUrl){
      var repo = repoUrl.replace(/^https:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+).*$/, "$1");
      repo = repo.includes("github.io") ? repo.replace(/^https:\/\/([^.]+)\.github\.io\/([^/]+)\/?$/, "$1/$2") : repo;
      var headers = { Authorization: `Bearer ${pat}` };
      var { default_branch } = await fetch(`https://api.github.com/repos/${repo}`, { headers }).then(r => r.json());
      var { object: { sha } } = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${default_branch}`, { headers }).then(r => r.json());
      var { tree } = await fetch(`https://api.github.com/repos/${repo}/git/trees/${sha}?recursive=1`, { headers }).then(r => r.json());
      var updateUrlPath = tree.find(i => i.path.match(/^(.*\.ver|(.*\.)?version|.*version.*\.(txt|info))$/i) || i.path.match(/Version$/))?.path;
      if (updateUrlPath)
        p.updateUrl = await fetch(`https://api.github.com/repos/${repo}/contents/${updateUrlPath}`, { headers }).then(r => r.json()).then(d => d.download_url);
      if (!p.download){
        var release = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers }).then(r => r.json());
        var browserDownloadUrls = release.assets?.map(i => i.browser_download_url);
        p.download = browserDownloadUrls?.find(i => i.endsWith(".plgx")) ?? browserDownloadUrls?.find(i => i.endsWith(".dll")) ?? browserDownloadUrls?.find(i => i.endsWith(".zip"));
        if (!p.download) {
          var filePath = tree.find(i => i.path.endsWith(".plgx"))?.path ?? tree.find(i => i.path.endsWith(".dll") && !i.path.match(/\/(References|KeePass|libs)\//))?.path;
          if (filePath)
            p.download = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, { headers }).then(r => r.json()).then(d => d.download_url);
        }
      }
      p.download = p.download?.replace(/\/releases\/download\/[^/]+/, "/releases/latest/download")?.replace(/\d+\.\d+(\.\d+)?(\.\d+)?/, match => match.split(".").map((num, i) => ["{0}", "{1}", "{2}", "{3}"][i] || num).join("."));
    }
    return p;
  }));
await Deno.writeTextFile("plugins.json", JSON.stringify(plgs, null, 2));
