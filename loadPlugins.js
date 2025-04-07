import { DOMParser } from "jsr:@b-fuze/deno-dom";

async function main() {
  var externalVersions = [];
  var sourceText = await fetch("https://keepass.info/plugins.html").then(i => i.text());
  var doc = new DOMParser().parseFromString(sourceText, "text/html");
  var plugins = extractPlugins(doc);
  plugins = await enrichPluginData(plugins, externalVersions);
  await writeOutputFiles(plugins, externalVersions);
}

function extractPlugins(doc) {
  return [...doc.querySelectorAll(".tablebox")].filter(i => i.querySelector('img[alt="2.x"]') && i.getAttribute("id") != "testplugin" && !i.getAttribute("id").startsWith("convertto")).flatMap(i => {
    var id = i.getAttribute("id");
    var extMeta = i.querySelector(".extmeta");
    var description = i.querySelector("td").innerText.replace(extMeta?.innerText,"").replace(/\n\n+/g,"\n\n").trim();
    var idx = description.split("\n").findIndex(str => str.includes('['));
    if (idx != -1)
      description = description.split("\n").slice(0, idx - 1).join("\n");
    description = description?.replace(/(?<!\n)\n(?!\n)/g, " ").replace(/\n\n/g, "\n").trim();
    var el;
    var group = (el = doc.querySelector(`[href="#${id}"]`)) && (() => { while (el && !el.classList.contains('extindexgroup')) el = el.previousElementSibling; return el; })().innerText;
    if (i.querySelector("ul.withspc"))
      return getPluginLists(i, id, description, group);
    var title = i.querySelector("th").innerText.trim();
    var shortdescNode = doc.querySelector(`[href="#${id}"]~br`);
    var shortdesc = "";
    while((shortdescNode = shortdescNode?.nextSibling) && shortdescNode.nodeName != "BR") {shortdesc += shortdescNode.textContent.trim() + (shortdescNode.nodeType == 3 ?  " " : "")};
    shortdesc = shortdesc.trim();
    var authors = extMeta?.innerText.match(/Authors?:(.*?)\. Language/s)?.[1]?.replace("\n"," ").trim();
    authors = (authors?.match(/\([^,]*\)/) ? authors.match(/\(and /) ? authors.split(/ \(and |\)/) : authors.split(/, /) : authors?.split(/ \(|\)|, /))?.filter(i => i);
    var language = (extMeta ? [...extMeta?.innerHTML.matchAll(/<img[^>]+alt="([^"]+)"/g)] : [])?.map(match => match?.[1]);
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
    var forks = getForks(i, id, title, language, description, note, similar, group, sourceCode, download);
    return [{id, title, shortdesc, authors, language, description, note, similar, group, sourceCode, download, website}, ...forks]}).filter(i => i.authors);
}

function getPluginLists(node, id, description, group){
  return [...node.querySelectorAll("ul.withspc > li")].filter(i => !i.querySelector('[alt="1.x"]'))
    .map(li => {
    var title = li.querySelector("b,strong")?.innerText.trim();
    var listId = id + title.toLowerCase().replace(/\W/g, "");
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
    return {id: listId, title, authors, language, website, description, group};
  });
}

function getForks(node, id, title, language, description, note, similar, group, sourceCode, download){
  return [...node.querySelectorAll("td b")].filter(b => b.innerText.includes("Fork")).map(b => {
    var forkInfo = b.nextSibling?.textContent?.trim().replace("by", "").replace(":", "").trim().split(" (");
    var authors = [forkInfo[0]];
    description += forkInfo[1] ? "\n" + forkInfo[1].replace(")","") : "";
    id += "_fork";
    title += " (fork)"
    var website = b.parentElement.querySelector("a")?.getAttribute("href");
    return {id, title, authors, language, description, note, similar, group, sourceCode, download, website};
  });
}

async function enrichPluginData(plugins, externalVersions) {
  return await Promise.all(plugins.map(async (plugin) => {
    if (plugin.website?.includes("github") || plugin.sourceCode?.includes("github")) {
      plugin = await enrichGitHubData(plugin);
    } 
    else if (plugin.website?.includes("sourceforge.net/projects")) {
      [plugin, externalVersions] = await enrichSourceForgeData(plugin, externalVersions);
    }
    [plugin, externalVersions] = enrichVersionData(plugin, externalVersions);
    return plugin;
  }));
}

async function enrichGitHubData(plugin) {
  var githubRepo = plugin.website?.includes("github") ? plugin.website : plugin.sourceCode?.includes("github") ? plugin.sourceCode : undefined;
  if (githubRepo) {
    var repo = githubRepo.replace(/^https:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+).*$/, "$1");
    repo = repo.includes("github.io") ? repo.replace(/^https:\/\/([^.]+)\.github\.io\/([^/]+)\/?$/, "$1/$2") : repo;
    var headers = { Authorization: `Bearer ${Deno.env.get("GITHUB_PAT")}` };
    var { default_branch } = await fetch(`https://api.github.com/repos/${repo}`, { headers }).then(r => r.json());
    if (!default_branch)
    {
      if (plugin.website?.includes("github"))
        plugin.website = null;
      if (plugin.sourceCode?.includes("github"))
        plugin.sourceCode = null;
      return plugin;
    }
    var { object: { sha } } = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${default_branch}`, { headers }).then(r => r.json());
    var { tree } = await fetch(`https://api.github.com/repos/${repo}/git/trees/${sha}?recursive=1`, { headers }).then(r => r.json());
    var updateUrlPath = tree.find(i => i.path.match(/^(.*\.ver|(.*\.)?version|.*version.*\.(txt|info))$/i) || i.path.match(/Version$/))?.path;
    if (updateUrlPath) {
      plugin.updateUrl = await fetch(`https://api.github.com/repos/${repo}/contents/${updateUrlPath}`, { headers }).then(r => r.json()).then(d => d.download_url);
    }
    if (!plugin.download) {
      var release = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers }).then(r => r.json());
      var browserDownloadUrls = release.assets?.map(i => i.browser_download_url);
      plugin.download = browserDownloadUrls?.find(i => i.endsWith(".plgx")) ?? browserDownloadUrls?.find(i => i.endsWith(".dll")) ?? browserDownloadUrls?.find(i => i.endsWith(".zip"));
      if (!plugin.download) {
        var filePath = tree.find(i => i.path.endsWith(".plgx"))?.path ?? tree.find(i => i.path.endsWith(".dll") && !i.path.match(/\/(References|KeePass|libs)\//))?.path;
        if (filePath) {
          plugin.download = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, { headers }).then(r => r.json()).then(d => d.download_url);
        }
      }
    }
  }
  return plugin;
}

async function enrichSourceForgeData(plugin, externalVersions) {
  if (plugin.website?.includes("sourceforge.net/projects")) {
    plugin.download = plugin.website + "files/latest/download";
    var resp = await fetch(plugin.website + "/rss").then(response => response.text());
    var doc = new DOMParser().parseFromString(resp, "text/html");
    var version = (doc.querySelector('[url$=".plgx/download"]') ?? doc.querySelector('[url$=".dll/download"]') ?? doc.querySelector('[url$=".zip/download"]'))?.getAttribute("url")?.match(/(\d+(\.\d+){1,3})/)?.[1];
    if (version && !plugin.updateUrl) {
      externalVersions.push(plugin.title + ":" + version);
      plugin.updateUrl = "https://raw.githubusercontent.com/CennoxX/plugin_tests/main/mirroredVersion.info";
    }
  }
  return [plugin, externalVersions]
}

function enrichVersionData(plugin, externalVersions) {
  var version = plugin.download?.match(/(\d+(\.\d+){1,3})/)?.[1];
  if (version){
    if (version == plugin.sourceCode?.match(/(\d+(\.\d+){1,3})/)?.[1]) {
      plugin.sourceCode = plugin.sourceCode?.replace(version, match => match.split(".").map((num, i) => ["{mayor}", "{minor}", "{patch}", "{build}"][i] || num).join("."));
    }
    if (!plugin.updateUrl) {
      externalVersions.push(plugin.title + ":" + version);
      plugin.updateUrl = "https://raw.githubusercontent.com/CennoxX/plugin_tests/main/mirroredVersion.info";
    }
    if (plugin.download?.includes("github.com")) {
      plugin.download = plugin.download?.replace(/\/releases\/download\/[^/]+/, "/releases/latest/download");
    }
    plugin.download = plugin.download?.replace(version, match => match.split(".").map((num, i) => ["{mayor}", "{minor}", "{patch}", "{build}"][i] || num).join("."));
  }
  return [plugin, externalVersions];
}


async function writeOutputFiles(plugins, externalVersions) {
  await Deno.writeTextFile("plugins.json", JSON.stringify(plugins, null, 2));
  await Deno.writeTextFile("mirroredVersion.info", ":\n" + externalVersions.sort().join("\n") + "\n:");
}

main().catch(console.error);
