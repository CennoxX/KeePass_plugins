import { DOMParser } from "jsr:@b-fuze/deno-dom";

async function main() {
  var externalVersions = [];
  var sourceText = await fetch("https://keepass.info/plugins.html").then(i => i.text());
  var doc = new DOMParser().parseFromString(sourceText, "text/html");
  var plugins = extractPlugins(doc);
  await enrichPluginData(plugins, externalVersions);
  await Deno.writeTextFile("allVersion.info", ":\n" + externalVersions.sort().join("\n") + "\n:");
}

function extractPlugins(doc) {
  return [...doc.querySelectorAll(".tablebox")].filter(i => i.querySelector('img[alt="2.x"]') && i.getAttribute("id") != "testplugin" && !i.getAttribute("id").startsWith("convertto")).flatMap(i => {
    var id = i.getAttribute("id");
    if (i.querySelector("ul.withspc"))
      return getPluginLists(i, id);
    var title = i.querySelector("th").innerText.trim();
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
    var forks = getForks(i, id, title);
    return [{id, title, sourceCode, download, website}, ...forks]});
}

function getPluginLists(node, id){
  return [...node.querySelectorAll("ul.withspc > li")].filter(i => !i.querySelector('[alt="1.x"]'))
    .map(li => {
    var title = li.querySelector("b,strong")?.innerText.trim();
    var listId = id + title.toLowerCase().replace(/\W/g, "");
    var extMeta = li.querySelector(".extmeta");
    var website = [...li.childNodes].find(c => c.textContent?.includes("[Website") || c.textContent?.includes("Website]"))?.getAttribute("href");
    return {id: listId, title, website};
  });
}

function getForks(node, id, title){
  return [...node.querySelectorAll("td b")].filter(b => b.innerText.includes("Fork")).map(b => {
    id += "_fork";
    title += " (fork)"
    var website = b.parentElement.querySelector("a")?.getAttribute("href");
    return {id, title, website};
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
    externalVersions = enrichVersionData(plugin, externalVersions);
  }));
}

async function enrichGitHubData(plugin) {
  var githubRepo = plugin.website?.includes("github") ? plugin.website : plugin.sourceCode?.includes("github") ? plugin.sourceCode : undefined;
  if (githubRepo) {
    var repo = githubRepo.replace(/^https:\/\/(?:www\.)?github\.com\/([^/]+\/[^/#]+).*$/, "$1");
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
    if (version) {
      externalVersions.push(plugin.title + ":" + version);
    }
  }
  return [plugin, externalVersions]
}

function enrichVersionData(plugin, externalVersions) {
  var version = plugin.download?.match(/(\d+(\.\d+){1,3})/)?.[1];
  if (version){
    externalVersions.push(plugin.title + ":" + version);
  }
  return externalVersions;
}

main().catch(console.error);
