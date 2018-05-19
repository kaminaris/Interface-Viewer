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

		this.clip = {
			pixel: {top: 0, left: 0, bottom: 0, right: 0},
			coord: {top: 0, left: 0, bottom: 1, right: 1},
		};

		localforage.config({
			driver: localforage.WEBSQL, // Force WebSQL; same as using setDriver()
			name: 'wowInterfaceViewer',
			version: 1.0,
			size: 100000000, // Size of database, in bytes. WebSQL-only for now.
			storeName: 'keyvaluepairs', // Should be alphanumeric, with underscores.
			description: 'some wowInterfaceViewer'
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
		return string.replace(/:([a-zA-Z_]+)/g, function (m, $1) {
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

	preview(file) {
		this.currentFile = file;
		this.showModal = true;
	}

	updateImageSize(img) {
		this.currentSize = {
			width: img[0].naturalWidth,
			height: img[0].naturalHeight
		};
		console.log(this.currentSize);
		this.updateClip('coord');
	}

	updateClip(type) {

		let prec = 10;
		switch (type) {
			// coordinates were updated, need to calc pixels
			case 'coord':
				this.clip.pixel.top = Math.round(this.clip.coord.top * this.currentSize.height * prec) / prec;
				this.clip.pixel.bottom = Math.round(this.clip.coord.bottom * this.currentSize.height * prec) / prec;
				this.clip.pixel.left = Math.round(this.clip.coord.left * this.currentSize.width * prec) / prec;
				this.clip.pixel.right = Math.round(this.clip.coord.right * this.currentSize.width * prec) / prec;
				break;
			// pixels were updated, need to calc coordinates
			case 'pixel':
				prec = 10000;
				this.clip.coord.top = Math.round(this.clip.pixel.top / this.currentSize.height * prec) / prec;
				this.clip.coord.bottom = Math.round(this.clip.pixel.bottom / this.currentSize.height * prec) / prec;
				this.clip.coord.left = Math.round(this.clip.pixel.left / this.currentSize.width * prec) / prec;
				this.clip.coord.right = Math.round(this.clip.pixel.right / this.currentSize.width * prec) / prec;
				break;
		}
	}

	getImgClip() {
		return 'rect(' +
			this.clip.pixel.top + 'px, ' +
			this.clip.pixel.right + 'px, ' +
			this.clip.pixel.bottom + 'px, ' +
			this.clip.pixel.left + 'px)';
	}
}

app.controller('MainController', MainController);

app.directive('imageonload', function () {
	return {
		restrict: 'A',
		scope: {
			imageonload: '&'
		},
		link: function (scope, element, attrs) {
			element.bind('load', function () {
				//call the function that was passed
				scope.$apply(() => {
					scope.imageonload({element: element})
				});
			});
		}
	};
});