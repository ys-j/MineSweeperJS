const privateMap = new WeakMap();
const getPrivates = self => {
	let p = privateMap.get(self);
	if (!p) {
		p = {};
		privateMap.set(self, p);
	}
	return p;
};

export class ContainerElement extends HTMLElement {
	/**
	 * Create container of mine sweeper.
	 * @param {number} x number of columns
	 * @param {number} y number of rows
	 * @param {number} n number of mines
	 */
	constructor(x, y, n) {
		super();
		this.cols = x;
		this.rows = y;
		this.mines = n;
		this.flags = n;

		const root = this.attachShadow({ mode: 'open' });
		this.style.gridTemplate = `repeat(${y+1},1.6em)/repeat(${x},1.6em)`;
		const style = document.createElement('link');
		style.rel = 'stylesheet';
		style.href = 'container.css';

		const self = getPrivates(this);
		self.mines = { length: x * y, columns: x, rows: y, mines: n };
		this.timer = new TimerElement();
		this.cells = Array.from(self.mines, (_, i) => new CellElement(i, x, y));
		root.append(style, this.timer, ...this.cells);

		this.addEventListener('click', e => {
			const path = e.composedPath();
			this.putMines([ path[0].index, ...path[0].adjacencies ]);
			getPrivates(e.target.timer).start();
		}, { capture: true, once: true, passive: true });

		self.complete = callback => {
			getPrivates(this.timer).stop(true);
			callback();
		};
	}
	get cols() {
		return this.getAttribute('cols')|0;
	}
	set cols(x) {
		this.setAttribute('cols', x);
	}
	get rows() {
		return this.getAttribute('rows')|0;
	}
	set rows(y) {
		this.setAttribute('rows', y);
	}
	get mines() {
		return this.getAttribute('mines')|0;
	}
	set mines(n) {
		this.setAttribute('mines', n);
	}
	get flags() {
		return this.getAttribute('flags')|0;
	}
	set flags(n) {
		this.setAttribute('flags', n);
	}
	get closingNumber() {
		return this.cells.filter(cell => !cell.isOpened).length;
	}
	/**
	 * Count and set number of flags to attribute.
	 * @returns {number} number of flags
	 */
	countFlags() {
		const number = this.mines - this.cells.filter(cell => cell.isFlagged).length;
		this.flags = number;
		return number;
	}
	/**
	 * Terminates game due to player's failure.
	 * @param {Function} callback callback function
	 */
	over(callback) {
		getPrivates(this.timer).stop(false);
		const mines = getPrivates(this).mines;
		for (let i = 0; i < mines.length; i++) {
			if (mines[i]) {
				this.cells[i].className = 'mine';
			}
		}
		callback();
	}
	/**
	 * Puts mines randomly
	 * @param {number[]} excepts exception cell's indices
	 */
	putMines(excepts) {
		const mines = getPrivates(this).mines;
		for (let i = 0; i < mines.mines; i++) {
			const index = Math.ceil(Math.random() * mines.length);
			if (!excepts.includes(index) && index < mines.length && !mines[index]) {
				mines[index] = true;
			} else {
				i--;
			}
		}
		this.cells.forEach((cell, i) => {
			getPrivates(cell).mine = mines[i] ? 9 : cell.adjacencies.reduce((p, c) => p + (mines[c]|0), 0);
		});
	}
}

export class CellElement extends HTMLElement {
	/**
	 * Create cell of mine sweeper.
	 * @param {number} i cell's index
	 * @param {number} x container's columns
	 * @param {number} y container's rows
	 */
	constructor(i, x, y) {
		super();
		this.index = i;
		let _adjacencies = [];
		switch (i % x) {
			case 0: _adjacencies = [-x, -x+1, +1, +x, +x+1]; break;
			case (x-1): _adjacencies = [-x-1, -x, -1, +x-1, +x]; break;
			default: _adjacencies = [-x-1, -x, -x+1, -1, +1, +x-1, +x, +x+1];
		}
		this.adjacencies = _adjacencies.map(v => v + i).filter(v => 0 <= v && v < x * y);
		this.addEventListener('click', e => {
			this.open();
		});
		this.addEventListener('auxclick', e => {
			e.preventDefault();
			if (this.isOpened) this.openAround();
		});
		this.addEventListener('contextmenu', e => {
			e.preventDefault();
			if (!this.isOpened) this.flag();
		});

		const dbltap = { count: 0, timer: 0 };
		const longtap = { timer: 0 };
		this.addEventListener('touchstart', e => {
			e.preventDefault();
			if (dbltap.count) {
				dbltap.count = 0;
				clearTimeout(dbltap.timer);
				clearTimeout(longtap.timer);
				if (this.isOpened) this.openAround();
			} else {
				dbltap.count = 1;
				dbltap.timer = setTimeout(() => {
					dbltap.count = 0;
				}, 200);
				longtap.timer = setTimeout(() => {
					longtap.timer = Infinity;
					if (!this.isOpened) this.flag();
				}, 200);
			}
		});
		this.addEventListener('touchmove', e => {
			clearTimeout(longtap.timer);
			longtap.timer = Infinity;
		});
		this.addEventListener('touchend', e => {
			if (longtap.timer == Infinity) {
				clearTimeout(longtap.timer);
			} else {
				this.click();
			}
		}, { passive: true });
	}
	get isFlagged() {
		return this.classList.contains('flagged');
	}
	/**
	 * Puts or removes flag.
	 * @param {boolean} [switcher] operation switch that puts if true, removes if false, selects auto operation if undefined.
	 */
	flag(switcher = 2) {
		const method = ['remove', 'add', 'toggle'][switcher|0];
		this.classList[method]('flagged');
		this.parentNode.host.countFlags();
		navigator.vibrate(50);
	}
	get isOpened() {
		return this.hasAttribute('open');
	}
	/**
	 * Open this cell.
	 * @returns {boolean} whether cell has already opened
	 */
	open() {
		const mine = getPrivates(this).mine;
		let continuing = this.isOpened || this.isFlagged;
		if (!continuing) {
			continuing = (mine || 0) < 9;
			if (continuing) {
				this.setAttribute('open', mine || '');
				if (mine === 0) {
					this.openAround();
				}
			} else {
				this.parentNode.host.over(() => {
					navigator.vibrate(1000);
					document.getElementById('popup-lose').show();
				});
			}
		}
		return continuing;
	}
	/**
	 * Open cells around.
	 */
	openAround() {
		let flags = 0;
		const targets = [];
		const cells = this.parentNode.host.cells;
		this.adjacencies.forEach(i => {
			const target = cells[i];
			if (target) {
				targets.push(target);
				flags += target.isFlagged;
			}
		});
		if (flags === getPrivates(this).mine) {
			for (const target of targets) {
				if (!target.open()) break;
			}
		}
	}

	static get observedAttributes() { return ['open']; }
	attributeChangedCallback(_, oldValue, newValue) {
		const container = this.parentNode.host;
		if (container.closingNumber === container.mines) {
			getPrivates(container).complete(() => {
				document.getElementById('popup-win').show();
			});
		}
	}
}

export class TimerElement extends HTMLElement {
	constructor() {
		super();
		const self = getPrivates(this);
		self.startTime = 0;
		self.endTime = 0;
		self.start = () => {
			this.date = Date.now();
			self.startTime = performance.now();
			const refresh = () => {
				const now = performance.now();
				const diff = (now - self.startTime) % 1000;
				this.timer = setTimeout(refresh, 1000 - diff);
				this.display(now);
			};
			refresh();
		};
		self.stop = cleared => {
			self.endTime = performance.now();
			clearTimeout(this.timer);
			this.display(self.endTime, 3);
			self.cleared = cleared;
		};
		this.date = 0;
		this.display(0);
	}
	display(ms, degit) {
		const _s = (ms - getPrivates(this).startTime) / 1000;
		const m = Math.floor(_s / 60), s = _s % 60;
		this.textContent = m + ':' + (s < 10 ? '0' : '') + s.toFixed(degit || 0);
	}
}

export class Record {
	/**
	 * Create score record.
	 * @param {Timer} timer stopped timer
	 */
	constructor(timer) {
		const _timer = getPrivates(timer);
		this.time = _timer.cleared ? _timer.endTime - _timer.startTime : Infinity;
		this.date = new Date(timer.date).toISOString();
	}
	/**
	 * Return string as JSON format.
	 * @returns {string} JSON object 
	 */
	toString() {
		return `{"time":${this.time},"date":"${this.date}"}`;
	}
}