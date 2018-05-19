let app = angular.module('app', []);

class MainController {
	constructor($http, $scope, $filter) {
		this.$http = $http;
		this.$scope = $scope;
		this.$filter = $filter;
		this.apiUrl = 'https://api.github.com';
		this.files = [];

		this.settings = {
			repoUrl: 'https://github.com/Gethe/wow-ui-textures/'
		};

		localforage.config({
			driver      : localforage.WEBSQL, // Force WebSQL; same as using setDriver()
			name        : 'wowInterfaceViewer',
			version     : 1.0,
			size        : 100000000, // Size of database, in bytes. WebSQL-only for now.
			storeName   : 'keyvaluepairs', // Should be alphanumeric, with underscores.
			description : 'some wowInterfaceViewer'
		});

		let savedSettings = localStorage.getItem('settings');
		if (savedSettings) {
			angular.extend(this.settings, JSON.parse(savedSettings));
		}

		localforage.getItem('files', (err, value) => {
			if (!err) {
				$scope.$apply(() => {
					this.setFiles(value);
				});
			}
		});
	}

	saveSettings() {
		localStorage.setItem('settings', JSON.stringify(this.settings));
	}

	setFiles(files) {
		this.files = [];
		for (let i in files) {
			if (files[i].path === '.gitignore') {
				continue;
			}

			let nameNormalized = files[i].path.toLowerCase();
			if (nameNormalized.endsWith('.png')) {
				this.files.push(files[i]);
			}
		}

		this.filterFiles();
	}

	updatePagination() {
		if (!this.perPage) {
			this.perPage = 20;
		}

		this.pages = Math.ceil(this.filteredFiles.length / this.perPage);
		this.currentPage = 1;
	}

	gotoPage(pageNum, relative) {
		if (relative) {
			this.currentPage += pageNum;
		} else {
			this.currentPage = pageNum;
		}
	}

	getPages() {
		this.currentPage = parseInt(this.currentPage);

		let startFrom = this.currentPage - 1 - 5;
		if (startFrom < 1) {
			startFrom = 1;
		}

		let upTo = this.currentPage + 5;
		if (upTo > this.pages) {
			upTo = this.pages;
		}
		let arr = Array.apply(null, {length: this.pages}).map(Number.call, Number);

		return arr.slice(startFrom, upTo);
	}

	validateRepo() {
		let matches = this.settings.repoUrl.match(/https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\//);
		if (matches && matches[1] && matches[2]) {
			return {
				owner: matches[1],
				repo: matches[2]
			};
		}

		return false;
	}

	fillTemplate(string, vars) {
		return string.replace(/:([a-zA-Z_]+)/g, function(m, $1) {
			return vars[$1];
		});
	}

	buildApiUrl(settings, path, vars) {
		let variables = angular.extend(settings, vars);

		let p = this.fillTemplate(path, variables);
		return this.apiUrl + p;
	}

	readRepository() {
		let result = this.validateRepo();
		if (!result) {
			alert('Repository URL is incorrect. Correct format: https://github.com/Gethe/wow-ui-textures/');
			return;
		}

		let url = this.buildApiUrl(result, '/repos/:owner/:repo/git/trees/:tree_sha?recursive=1', {tree_sha: 'live'});
		console.log(url);
		this.$http.get(url).then((response) => {

			this.setFiles(response.data.tree);

			localforage.setItem('files', this.files, (err) => {
				// if err is non-null, we got an error
				console.log(err);
			});
		});
	}

	filterFiles() {
		this.filteredFiles = this.$filter('filter')(this.files, this.filter);
		this.updatePagination();
	}

	getFiles() {
		if (!this.filteredFiles) {
			return [];
		}

		let startFrom = (this.currentPage - 1) * this.perPage;
		if (startFrom < 0) {
			startFrom = 0;
		}

		let upTo = startFrom + this.perPage;

		console.log(startFrom, upTo);
		return this.filteredFiles.slice(startFrom, upTo);
	}

	getImageUrl(file) {
		let result = this.validateRepo();
		return this.fillTemplate('https://raw.githubusercontent.com/:owner/:repo/live/:path',
			angular.extend(result, {
				path: file.path,
			})
		);
	}

	getPath(file) {
		return 'Interface\\' + file.path.replace(/\//g, '\\');
	}
}

app.controller('MainController', MainController);