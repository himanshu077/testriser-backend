const https = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api-docs.json',
  method: 'GET',
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const swagger = JSON.parse(data);
    const paths = Object.keys(swagger.paths);

    console.log('\n📊 Swagger Documentation Summary\n');
    console.log('Total documented paths:', paths.length);

    // Group by prefix
    const grouped = {};
    paths.forEach((p) => {
      const parts = p.split('/').filter(Boolean);
      const prefix = '/' + parts.slice(0, 2).join('/');
      grouped[prefix] = (grouped[prefix] || []).concat(p);
    });

    console.log('\n📁 Paths by category:\n');
    Object.entries(grouped)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([prefix, pathList]) => {
        console.log(`  ${prefix.padEnd(30)} : ${pathList.length} paths`);
      });

    console.log('\n✅ Sample paths (first 15):\n');
    paths.slice(0, 15).forEach((p) => console.log(`  ${p}`));

    console.log(`\n  ... and ${paths.length - 15} more\n`);

    // Check for invalid paths (shouldn't start with /api/api or be missing /api)
    const invalidPaths = paths.filter((p) => p.startsWith('/api/api') || !p.startsWith('/api'));

    if (invalidPaths.length > 0) {
      console.log('⚠️  Warning: Found potentially invalid paths:\n');
      invalidPaths.forEach((p) => console.log(`  ${p}`));
    } else {
      console.log('✅ All paths have valid prefixes!\n');
    }
  });
});

req.on('error', (error) => {
  console.error('Error fetching Swagger JSON:', error.message);
  process.exit(1);
});

req.end();
