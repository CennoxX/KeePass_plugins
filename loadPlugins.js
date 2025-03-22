import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";

var source = await fetch("https://keepass.info/plugins.html");
var sourceText = await source.text();
var doc = new DOMParser().parseFromString(sourceText, "text/html");
var plgs = [...doc.querySelectorAll(".tablebox")].filter(i => i.querySelector('img[alt="2.x"]')).map(i => {
	var similar = [...i.querySelectorAll("td")].find(i => i.innerHTML.includes("<em>Similar plugin") || i.innerHTML.includes("<em>See also"));
	var shortdescNode = doc.querySelector("[href='#"+i.id+"']~br");
	var description = i.innerText.replace(i.querySelector(".extmeta")?.innerText,"").trim().replace(/\n+/g,"\n\n");
	var authors = i.querySelector(".extmeta")?.innerText.match(/Authors?:(.*?)\. Language/s)?.[1]?.trim();
	var idx = description.split("\n").findIndex(str => str.includes('['));
	if (idx != -1)
		description = description.split("\n").slice(0, description.split("\n").findIndex(str => str.includes('['))-1).join("\n");
	var descriptionNodes = i.querySelector("td").childNodes;
	var sourceCode;
	idx = [...descriptionNodes].findIndex(c => c.textContent?.includes("Download source code"));
	if (idx != -1)
	{
		sourceCode = descriptionNodes[idx + 1].getAttribute("href");
	}
	else
	{
		idx = [...descriptionNodes].findIndex(c => c.textContent?.includes("[Source Code]"));
		if (idx != -1)
			sourceCode = descriptionNodes[idx].getAttribute("href");
	}
	var pluginDownload;
	idx = [...descriptionNodes].findIndex(c => c.textContent?.includes("Download plugin"));
	if (idx != -1)
	{
		pluginDownload = descriptionNodes[idx + 1].getAttribute("href");
	}
	else
	{
		idx = [...descriptionNodes].findIndex(c => c.textContent?.includes("[Download]"));
		if (idx != -1)
			pluginDownload = descriptionNodes[idx].getAttribute("href");
	}
	var website;
  var el;
	idx = [...descriptionNodes].findIndex(c => c.textContent?.includes("[Website"));
	if (idx != -1)
		website = descriptionNodes[idx].getAttribute("href");
	return {
	id: i.id,
	title: i.querySelector("th").innerText.trim(),
	shortdesc: shortdescNode[(shortdescNode.nextSibling.textContent.trim() ? "nextSibling" : "nextElementSibling")]?.textContent.trim(),
	authors: (authors?.match(/\([^,]*\)/) ? authors.match(/\(and /) ? authors.split(/ \(and |\)/) : authors.split(/, /) : authors?.split(/ \(|\)|, /))?.filter(i => i),
	language: (i.querySelector(".extmeta")? [...i.querySelector(".extmeta")?.innerHTML.matchAll(/<img[^>]+alt="([^"]+)"/g)] : [])?.map(match => match?.[1]),
	description: description,
	note: [...i.querySelectorAll("td")].find(i => i.innerHTML.includes("<em>Note") || i.innerHTML.includes(`<em><span style="color: #BB0000;">Warning:`))?.innerText.replace("Note: ", "").replace(" Warning: ", ""),
	similar: similar ? [...similar.querySelectorAll("a")].map(i => i.getAttribute("href").split("#").pop()) : [],
	group: (el = doc.querySelector(`[href="#${i.id}"]`)) && (() => { while (el && !el.classList.contains('extindexgroup')) el = el.previousElementSibling; return el; })().innerText,
	sourceCode: sourceCode,
	download: pluginDownload,
	website: website
	}}).filter(i => i.authors && !i.id.startsWith("convertto") && i.id != "testplugin")
await Deno.writeTextFile("plugins.json", JSON.stringify(plgs, null, 2));
