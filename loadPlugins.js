import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";

var source = await fetch("https://keepass.info/plugins.html");
var sourceText = await source.text();
var doc = new DOMParser().parseFromString(sourceText, "text/html");
var plgs = [...doc.querySelectorAll(".tablebox")].filter(i => i.querySelector('img[alt="2.x"]' && !i.id.startsWith("convertto") && i.id != "testplugin")).flatMap(i => {
	var extMeta = i.querySelector(".extmeta");
	var group = (el = doc.querySelector(`[href="#${i.id}"]`)) && (() => { while (el && !el.classList.contains('extindexgroup')) el = el.previousElementSibling; return el; })().innerText;
	var description = i.querySelector("td").innerText.replace(extMeta?.innerText,"").replace(/\n\n+/g,"\n\n").trim();
	var idx = description.split("\n").findIndex(str => str.includes('['));
	if (idx != -1)
    	description = description.split("\n").slice(0, idx - 1).join("\n");
	if (i.querySelector("ul.withspc")) {
    	return [...i.querySelectorAll("ul.withspc > li")].filter(i => !i.querySelector('[alt="1.x"]'))
		.map(li => {
            	var title = li.querySelector("b,strong")?.innerText.trim();
            	var id = i.id + title.toLowerCase().replace(/\W/g, "");
            	var extMeta = li.querySelector(".extmeta");
            	var authors = extMeta?.innerText.match(/Authors?:(.*?)\. Language/s)?.[1]?.replace("\n", " ").trim();
            	authors = (authors?.match(/\([^,]*\)/) ? authors.match(/\(and /) ? authors.split(/ \(and |\)/) : authors.split(/, /) : authors?.split(/ \(|\)|, /))?.filter(i => i);
            	var language = [...(extMeta?.innerHTML.matchAll(/<img[^>]+alt="([^"]+)"/g) || [])].map(match => match?.[1]);
            	var website = [...li.childNodes].find(c => c.textContent?.includes("[Website") || c.textContent?.includes("Website]"))?.getAttribute("href");
            	var desc = li.innerText.replace(extMeta?.innerText, "").split("\n");
            	var idx = desc.findIndex(str => str.includes('['));
            	desc = desc.slice(2, idx - 1).join("\n");
            	description = desc ? desc : description;
            	return {id, title, authors, language, website, description, group};
    	});
	}
	var id = i.id;
	var title = i.querySelector("th").innerText.trim();
	var shortdescNode = doc.querySelector("[href='#"+i.id+"']~br");
	var shortdesc = shortdescNode[(shortdescNode.nextSibling.textContent.trim() ? "nextSibling" : "nextElementSibling")]?.textContent.trim();
	var authors = extMeta?.innerText.match(/Authors?:(.*?)\. Language/s)?.[1]?.replace("\n"," ").trim();
	authors = (authors?.match(/\([^,]*\)/) ? authors.match(/\(and /) ? authors.split(/ \(and |\)/) : authors.split(/, /) : authors?.split(/ \(|\)|, /))?.filter(i => i);
	var language = (extMeta? [...extMeta?.innerHTML.matchAll(/<img[^>]+alt="([^"]+)"/g)] : [])?.map(match => match?.[1]);
	var getLink = (node, text) => {
		var nodes = node.querySelector("td").childNodes;
		var idx = [...nodes].findIndex(c => c.textContent?.includes(text));
		return idx == -1 ? null : nodes[idx + (nodes[idx].tagName ? 0 : 1)].getAttribute("href");
	};
	var sourceCode = getLink(i, "Download source code") || getLink(i, "[Source Code]");
	var download = getLink(i, "Download plugin") || getLink(i, "[Download]");
	var website = getLink(i, "[Website") || getLink(i, "Website]");
	var similar = [...i.querySelectorAll("td")].find(i => i.innerHTML.includes("<em>Similar plugin") || i.innerHTML.includes("<em>See also"));
	var note = [...i.querySelectorAll("td")].find(i => i.innerHTML.includes("<em>Note") || i.innerHTML.includes(`<em><span style="color: #BB0000;">Warning:`))?.innerText.replace("Note:", "").replace(" Warning: ", "").trim();
	description = description?.replace(/(?<!\n)\n(?!\n)/g, " ").replace(/\n\n/g, "\n").trim();
	similar = similar ? [...similar.querySelectorAll("a")].map(i => i.getAttribute("href").split("#").pop()) : [];
	var formatUrl = (url) => url && !url.startsWith("http") ? "https://keepass.info/" + url : url;
	download = formatUrl(download);
	sourceCode = formatUrl(sourceCode);
	website = formatUrl(website);
	return {id, title, shortdesc, authors, language, description, note, similar, group, sourceCode, download, website}}).filter(i => i.authors);
await Deno.writeTextFile("plugins.json", JSON.stringify(plgs, null, 2));
