#! /bin/env -S deno run -A --unstable-raw-imports

import dockerfileTemplate from './Dockerfile.template' with { type: 'text' };
import entrypointTemplate from './entrypoint.sh.template' with { type: 'text' };

async function getLatestVersion(): Promise<string> {
  const res = await fetch("https://terraria.wiki.gg/wiki/Server").then((res) =>
    res.text(),
  );
  const regex =
    /https:\/\/terraria\.org\/api\/download\/pc-dedicated-server\/terraria-server-(\d+)\.zip/;
  // このページには複数のURLが含まれるが、たぶん最初に書かれているものが最新だろうということにしておく
  const match = res.match(regex);
  if (!match) {
    throw new Error("No match found");
  }
  return match[1];
}

async function main() {
    const version = await getLatestVersion();
    console.log(`${version} にアップデート`);

    const dockerfile = dockerfileTemplate.replaceAll('<version>', version);
    const entrypoint = entrypointTemplate.replaceAll('<version>', version);

    await Deno.writeTextFile(import.meta.dirname+'/Dockerfile', dockerfile);
    await Deno.writeTextFile(import.meta.dirname+'/entrypoint.sh', entrypoint);
}

main()
