import {
  listBlockFiles,
  readBlockFile,
  listDividerFiles,
  readDividerFile
} from "../blocks/blockRegistry.js";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export async function chooseLayout(emailType, aesthetic = "minimal_clean") {
  const [b1, b2, b3] = await Promise.all([
    listBlockFiles(emailType, aesthetic, "block1"),
    listBlockFiles(emailType, aesthetic, "block2"),
    listBlockFiles(emailType, aesthetic, "block3"),
  ]);

  if (!b1.length || !b2.length || !b3.length) {
    throw new Error(
      `Missing blocks: block1(${b1.length}) block2(${b2.length}) block3(${b3.length}) for ${emailType}/${aesthetic}`
    );
  }

  return {
    layoutId: `${emailType}-${aesthetic}-${Date.now()}`,
    block1: pick(b1),
    block2: pick(b2),
    block3: pick(b3),
  };
}

export async function composeBaseMjml(emailType, aesthetic, layout) {
  const dividerNames = await listDividerFiles(); // filenames only
  const dividerName1 = dividerNames.length ? pick(dividerNames) : null;
  const dividerName2 = dividerNames.length ? pick(dividerNames) : null;

  const [b1, b2, b3, divider1, divider2] = await Promise.all([
    readBlockFile(emailType, aesthetic, "block1", layout.block1),
    readBlockFile(emailType, aesthetic, "block2", layout.block2),
    readBlockFile(emailType, aesthetic, "block3", layout.block3),
    dividerName1 ? readDividerFile(dividerName1) : Promise.resolve(""),
    dividerName2 ? readDividerFile(dividerName2) : Promise.resolve(""),
  ]);

  const mark = (name) => `\n<mj-raw>\n  <!-- Blockfile: ${name} -->\n</mj-raw>\n`;

  const pieces = [
    mark(layout.block1) + b1.trim(),
    divider1 ? mark(`divider/${dividerName1}`) + divider1.trim() : "",
    mark(layout.block2) + b2.trim(),
    divider2 ? mark(`divider/${dividerName2}`) + divider2.trim() : "",
    mark(layout.block3) + b3.trim(),
  ].filter(Boolean);

  return `<mjml>
  <mj-body>
${pieces.join("\n\n")}
  </mj-body>
</mjml>`;
}
