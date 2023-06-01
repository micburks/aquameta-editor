#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

// TODO: use in bundle relase
const monacoVersion = JSON.parse(
  fs.readFileSync('package.json', 'utf-8')
).dependencies["monaco-editor"];

const sql = postgres({
  database: 'aquameta',
});

const bundle = 'org.aquameta.ui.editor';

(async () => {
  const dist = path.resolve('dist');
  const files = fs.readdirSync(dist);

  await deleteMonaco();

  if (await bundleExists()) {
    await deleteBundleContents();
  } else {
    await createBundle();
  } 

  await widgetModule(
    'monaco-editor',
    fs.readFileSync(
      path.resolve('monaco-editor.css'),
      'utf-8',
    ),
    'css',
  );

  for (const file of files) {
    const fileWithoutVersion = file.replace(/@.*/, '');
    if (path.extname(file) === '.js') {
      // name, version, type
      await widgetModule(
        fileWithoutVersion,
        fs.readFileSync(
          path.join(dist, file),
          'utf-8',
        ),
        'js'
      );
    }
  }

  await commitBundle();
  await sql.end({ timeout: 5 });
})();

async function createBundle() {
  console.log('create bundle');
  try {
    await sql`
      select bundle.bundle_create(${bundle})
    `;
  } catch (e) {
    console.error(e,);
  }
  return '';
}

async function commitBundle() {
  console.log('bundle commit');
  try {
    await sql`
      select bundle.commit(${bundle}, 'Automated import. Version ${monacoVersion}')
    `;
  } catch (e) {
    console.error(e,);
  }
  return '';
}

async function bundleExists() {
  try {
    const exists = await sql`
      select 1 from bundle.bundle where name=${bundle}
    `;
    console.log('exists', exists.length > 0);
    return exists.length > 0;
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function deleteBundleContents() {
  console.log('delete contents');
  try {
    const rows = await sql`
      select
        (hcr.row_id::meta.schema_id).name schema_name,
        (hcr.row_id::meta.relation_id).name relation_name,
        ((hcr.row_id).pk_column_id).name pk_column_name,
        (hcr.row_id).pk_value pk_value
      from bundle.head_commit_row hcr
        join bundle.bundle b on b.id=hcr.bundle_id
      where b.name=${bundle};
    `;
    for (const row of rows) {
      const id = {
        pk_value: row.pk_value,
        pk_column_id: {
          name: row.pk_column_name,
          relation_id: {
            name: row.relation_name,
            schema_id: {
              name: row.schema_name,
            }
          }
        }
      };
      console.log(id);
      await sql`
        select bundle.stage_row_delete(${bundle}, ${id})
      `;
    }
  } catch (e) {
    console.error(e,);
  }
  return '';
}

async function deleteMonaco() {
  console.log('delete monaco');
  try {
    await sql`
      delete from widget.module where name like '%monaco%';
    `;
  } catch (e) {
    console.error(e,);
  }
  return '';
}

async function widgetModule(name, content, type) {
  const obj = {name, content, type};
  try {
    const row = await sql`
      insert into widget.module ${sql(obj)} returning id
    `;
    const id = row[0].id;
    await sql`
      select bundle.tracked_row_add(${bundle}, 'widget', 'module', 'id', ${id})
    `;
    await sql`
      select bundle.stage_row_add(${bundle}, 'widget', 'module', 'id', ${id})
    `;
  } catch (e) {
    console.error(e);
    console.log(name);
  }
  return '';
};
