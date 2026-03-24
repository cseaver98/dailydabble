# Raw SVG Input

Drop raw SVG doodles in this folder and run:

`npm run pipeline:build`

Optional flags:
- `-- --strategy=complexity` : reorder paths by computed complexity before splitting
- `-- --stages=5` : number of reveal stages (2-9)

Output files are generated into:
- `content/processed/*.json`
- `content/previews/*.html`
