#!/usr/bin/env node

const {importDir} = require('aquameta-sync');
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

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

  await widgetDependencyCss(
    'monaco-editor',
    fs.readFileSync(
      path.resolve('monaco-editor.css'),
      'utf-8',
    )
  );

  for (const file of files) {
    const table = path.extname(file) === '.js' ? 'widget.dependency_js' : 'endpoint.resource';
    const fileWithoutVersion = file.replace(/@.*/, '');
    /*
    const outDir = path.join(
      path.resolve('data'),
      table,
      (counter++).toString(),
    );
    */
    // fs.mkdirSync(outDir, {recursive: true});
    if (table === 'endpoint.resource') {
      console.log('endpoint.resource?', file);
      continue;
      // path, mimetype_id, content
      if (path.extname(file) !== '.ttf') {
        console.error('not a ttf file. something went terrible wrong');
      }
      await endpointResource(
        `/widget/dep/${monacoVersion}/${fileWithoutVersion}`,
        fs.readFileSync(
          path.join(dist, file),
          'utf-8',
        )
      );
      /*
      fs.writeFileSync(
        path.join(outDir, 'path'),
        `/widget/dep/${monacoVersion}/${file}`,
      );
      fs.writeFileSync(
        path.join(outDir, 'mimetype_id'),
        // application/x-font-ttf though technically it should be font/ttf
        // but aquameta doesn't have this mimetype yet
        '20ef9afd-ef67-4e77-8074-7df44c7b0ddc',
      );
      fs.renameSync(
        path.join(dist, file),
        path.join(outDir, 'content'),
      );
      */
    } else if (table === 'widget.dependency_js') {
      // name, version, content
      await widgetDependency(
        fileWithoutVersion,
        // file.replace(path.extname(file), ''),
        fs.readFileSync(
          path.join(dist, file),
          'utf-8',
        )
      );
      /*
      fs.writeFileSync(
        path.join(outDir, 'name'),
        file,
      );
      fs.writeFileSync(
        path.join(outDir, 'version'),
        monacoVersion,
      );
      fs.renameSync(
        path.join(dist, file),
        path.join(outDir, 'content'),
      );
      */
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
      select bundle.commit(${bundle}, 'Automated import')
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
      delete from widget.dependency_js where name like '%monaco%';
    `;
    await sql`
      delete from widget.dependency_css where name like '%monaco%';
    `;
  } catch (e) {
    console.error(e,);
  }
  return '';
}

async function endpointResource(path, content) {
  const obj = {path, mimetype_id: "20ef9afd-ef67-4e77-8074-7df44c7b0ddc", content};
  try {
    const row = await sql`
      insert into endpoint.resource ${sql(obj)} returning id
    `;
    const id = row[0].id;
    await sql`
      select bundle.tracked_row_add(${bundle}, 'endpoint', 'resource', 'id', ${id})
    `;
    await sql`
      select bundle.stage_row_add(${bundle}, 'endpoint', 'resource', 'id', ${id})
    `;
  } catch (e) {
    console.error(e,);
    console.log(path);
  }
  return '';
  /*
return `
insert into endpoint.resource
  (path, mimetype_id, content)
  values ("${path}", "20ef9afd-ef67-4e77-8074-7df44c7b0ddc", "${content.replace(/"/g, '\\"')}");
`;
*/
};

async function widgetDependency(name, content) {
  const obj = {name, version: monacoVersion, content};
  try {
    const row = await sql`
      insert into widget.dependency_js ${sql(obj)} returning id
    `;
    const id = row[0].id;
    await sql`
      select bundle.tracked_row_add(${bundle}, 'widget', 'dependency_js', 'id', ${id})
    `;
    await sql`
      select bundle.stage_row_add(${bundle}, 'widget', 'dependency_js', 'id', ${id})
    `;
  } catch (e) {
    console.error(e);
    console.log(name);
  }
  return '';
  /*
return `
insert into widget.dependency_js
  (name, version, content)
  values ("${name}", "${monacoVersion}", "${content.replace(/"/g, '\\"')}");
`;
    */
};

async function widgetDependencyCss(name, content) {
  const obj = {name, version: monacoVersion, content};
  try {
    const row = await sql`
      insert into widget.dependency_css ${sql(obj)} returning id
    `;
    const id = row[0].id;
    await sql`
      select bundle.tracked_row_add(${bundle}, 'widget', 'dependency_css', 'id', ${id})
    `;
    await sql`
      select bundle.stage_row_add(${bundle}, 'widget', 'dependency_css', 'id', ${id})
    `;
  } catch (e) {
    console.error(e);
    console.log(name);
  }
  return '';
};
