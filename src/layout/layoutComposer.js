import {
  listBlockFiles,
  readBlockFile,
  listDividerFiles,
  readDividerFile
} from "../blocks/blockRegistry.js";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * chooseLayout now **does not require block2** for Promotion/Productgrid.
 * Instead, it flags that we'll inject the [[PRODUCT_SECTION]] token in composeBaseMjml.
 */
export async function chooseLayout(emailType, aesthetic = "minimal_clean") {
  const isProductType = emailType === "Promotion" || emailType === "Productgrid";

  // Always need block1 & block3
  const [b1, b3] = await Promise.all([
    listBlockFiles(emailType, aesthetic, "block1"),
    listBlockFiles(emailType, aesthetic, "block3"),
  ]);

  if (!b1.length || !b3.length) {
    throw new Error(
      `Missing blocks: block1(${b1.length}) block3(${b3.length}) for ${emailType}/${aesthetic}`
    );
  }

  // For non-product types, we still pick a real block2 from disk
  let b2 = [];
  if (!isProductType) {
    b2 = await listBlockFiles(emailType, aesthetic, "block2");
    if (!b2.length) {
      throw new Error(
        `Missing blocks: block2(${b2.length}) for ${emailType}/${aesthetic}`
      );
    }
  }

  return {
    layoutId: `${emailType}-${aesthetic}-${Date.now()}`,
    block1: pick(b1),
    // if product type, we won't use a physical block2 file
    block2: isProductType ? null : pick(b2),
    block3: pick(b3),
    useProductSectionToken: isProductType, // <- important flag
    emailType,
    aesthetic,
  };
}

/**
 * composeBaseMjml will:
 *  - Read block1 + block3 as usual
 *  - For product types, **insert [[PRODUCT_SECTION]]** instead of reading block2
 *  - For other types, read block2 from disk normally
 *  - Insert divider elements between blocks when available
 */
export async function composeBaseMjml(emailType, aesthetic, layout) {
  const dividerNames = await listDividerFiles(); // filenames only
  const dividerName1 = dividerNames.length ? pick(dividerNames) : null;
  const dividerName2 = dividerNames.length ? pick(dividerNames) : null;

  // Read required blocks
  const [b1, b3, divider1, divider2] = await Promise.all([
    readBlockFile(emailType, aesthetic, "block1", layout.block1),
    readBlockFile(emailType, aesthetic, "block3", layout.block3),
    dividerName1 ? readDividerFile(dividerName1) : Promise.resolve(""),
    dividerName2 ? readDividerFile(dividerName2) : Promise.resolve(""),
  ]);

  // Determine block2 content
  let b2Content = "";
  let b2Label = "";
  if (layout.useProductSectionToken) {
    // Always inject token for Promotion/Productgrid
    b2Content = "[[PRODUCT_SECTION]]";
    b2Label = "block2/product-section.txt";
  } else {
    // Non-product types still read a real block2 file
    b2Content = await readBlockFile(emailType, aesthetic, "block2", layout.block2);
    b2Label = layout.block2;
  }

  const mark = (name) => `\n<mj-raw>\n  <!-- Blockfile: ${name} -->\n</mj-raw>\n`;

  const pieces = [
    mark(layout.block1) + b1.trim(),
    divider1 ? mark(`divider/${dividerName1}`) + divider1.trim() : "",
    mark(b2Label) + b2Content.trim(),
    divider2 ? mark(`divider/${dividerName2}`) + divider2.trim() : "",
    mark(layout.block3) + b3.trim(),
  ].filter(Boolean);

  return `<mjml>
  <mj-body>
${pieces.join("\n\n")}
  </mj-body>
</mjml>`;
}
