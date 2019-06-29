import { ContainerElement, CellElement, TimerElement, Record } from './minesweeper.js';

class PopUp extends HTMLElement {
	/**
	 * Create pop-up element.
	 * @param {Map<string, HTMLElement>} children map of children
	 */
	constructor(children, id) {
		super();
		this.id = id;
		const container = document.createElement('div');
		container.append(...children.values());
		this.append(container);
	}
	hide() {
		this.removeAttribute('open');
	}
	show() {
		this.setAttribute('open', '');
	}
	get css() {
		return this.shadowRoot.firstElementChild.textContent;
	}
	set css(cssText) {
		this.shadowRoot.firstElementChild.textContent += cssText;
	}
}

customElements.define('mine-sweeper', ContainerElement);
customElements.define('mine-cell', CellElement);
customElements.define('mine-timer', TimerElement);
customElements.define('pop-up', PopUp);

/**
 * Create new element with options.
 * @param {string} tag tag name
 * @param {object} options tag property
 */
function createElement(tag, options = {}) {
	const element = document.createElement(tag);
	for (let [key, value] of Object.entries(options)) {
		if (key.includes('.')) {
			const k = key.split('.', 2);
			element[k[0]][k[1]] = value;
		} else {
			element[key] = value;
		}
	}
	return element;
}

(function () {
	const form = document.forms.form;
	
	form.addEventListener('submit', createField);
	form.addEventListener('change', selectGrade, { passive: true });
	form.x.addEventListener('change', limitN, { passive: true });
	form.y.addEventListener('change', limitN, { passive: true });
	
	function createField(e = { preventDefault: () => {}, target: form }) {
		e.preventDefault();
		const values = ['x', 'y', 'n'].map(name => e.target[name].value|0);
		if (window.matchMedia('(orientation:portrait)').matches) {
			[values[0], values[1]] = [values[1], values[0]];
		}
		const container = new ContainerElement(...values);
		const wrapper = document.getElementById('wrapper');
		wrapper.replaceChild(container, wrapper.lastElementChild);
	}
	
	function selectGrade(e) {
		const values = e ? e.target.value.match(/(\d+)x(\d+),(\d+)/) : null;
		if (values) {
			values.forEach((v, i) => form[i].value = v);
			limitN();
			createField();
		} else {
			const valueList = Array.from(form.grade.options, option => option.value);
			const custom = form.x.value + 'x' + form.y.value + ',' + form.n.value;
			form.grade.value = valueList.includes(custom) ? custom : '';
		}
	}
	function limitN() {
		const x = form.x.value, y = form.y.value;
		form.n.max = Math.round(x * y * .4);
	}
	limitN();
	
	function displayScore() {
		function parseDate(UTCString) {
			const date = new Date(UTCString);
			const vars = [date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
			const suffix = ['-', ' ', ':', ':', ''];
			return date.getFullYear() + '-' + vars.map((v, i) => ('0' + v).slice(-2) + suffix[i]).join('');
		}
		const wrapper = document.getElementById('wrapper');
		let score = localStorage.getItem('score') || '{"easy":[],"normal":[],"hard":[]}';
		const records = JSON.parse(score);
		const table = document.createElement('table');
		if (!table.tHead) {
			table.innerHTML = `<caption><span data-i18n=score.title>Scores</span><a role=button href="javascript:localStorage.removeItem('score')" data-i18n=score.reset>Reset</a><thead><th><th data-i18n=score.time>Time (s)<th data-i18n=score.date>Date<tbody><tbody><tbody>`;
		}
		['easy', 'normal', 'hard'].forEach((grade, i) => {
			const tbody = table.tBodies[i];
			tbody.innerHTML = `<tr><th><th class=capitalize colspan=2 data-i18n=grade.${grade}>${grade}`;
			const a = document.createElement('a');
			a.className = 'icon-delete';
			a.setAttribute('href', '#');
			a.setAttribute('role', 'button');
			a.setAttribute('title', 'Delete');
			tbody.append(...records[grade].sort((a, b) => a.time - b.time).map(record => {
				const tr = document.createElement('tr');
				const children = [
					document.createElement('td'),
					document.createElement('td'),
					document.createElement('td'),
				];
				const _a = a.cloneNode();
				_a.onclick = () => {
					const regex = new RegExp(`{"time":${record.time},"date":"${record.date}"},?`);
					score = score.replace(regex, '').replace(/,\]/g, ']');
					localStorage.setItem('score', score);
					tbody.removeChild(tr);
					return false;
				};
				children[0].append(_a);
				children[1].append((record.time / 1000).toFixed(3));
				children[2].append(parseDate(record.date));
				tr.append(...children);
				return tr;
			}));

		});
		wrapper.replaceChild(table, wrapper.lastElementChild);
	}
	displayScore();

	function keepScore() {
		const wrapper = document.getElementById('wrapper');
		const container = wrapper.lastElementChild;
		if (container) {
			const grade = form.grade.selectedOptions[0].getAttribute('name');
			const score = JSON.parse(localStorage.getItem('score') || '{"easy":[],"normal":[],"hard":[]}');
			score[grade].push(new Record(container.timer));
			localStorage.setItem('score', JSON.stringify(score));
		}
	}

	/*
	POP-UP
	*/
	document.body.append(new PopUp(new Map([
		['head', createElement('strong', {
			textContent: 'You Win!',
			'dataset.i18n': 'popup.win',
		})],
		['button', createElement('button', {
			textContent: 'Keep score',
			'dataset.i18n': 'popup.button.keep',
			onclick: e => {
				keepScore();
				displayScore();
				e.target.offsetParent.hide();
			},
		})],
		['close', createElement('button', {
			textContent: 'Close',
			'dataset.i18n': 'popup.button.close',
			onclick: e => {
				e.target.offsetParent.hide();
			},
		})],
	]), 'popup-win'), new PopUp(new Map([
		['head', createElement('strong', {
			textContent: 'You lose!',
			'dataset.i18n': 'popup.lose',
		})],
		['button', createElement('button', {
			textContent: 'Retry',
			'dataset.i18n': 'popup.button.retry',
			onclick: e => {
				e.target.offsetParent.hide();
				document.forms.form.button.click();
			},
		})],
		['close', createElement('button', {
			textContent: 'Close',
			'dataset.i18n': 'popup.button.close',
			onclick: e => {
				e.target.offsetParent.hide();
			},
		})],
	]), 'popup-lose'));
})();
(async function () {
	/*
	i18n
	*/
	const langs = navigator.languages;
	const langgen = async function* (l) {
		let i = 0;
		while (i < l) {
			yield fetch('i18n/' + langs[i++] + '.json').then(res => res.json(), console.error);
		}
	};
	for await (const json of langgen(langs.length)) {
		if (json) {
			const elems = document.querySelectorAll('[data-i18n]');
			elems.forEach(elem => {
				const keys = elem.dataset.i18n.split('.');
				let i = 0;
				let parent = json, value;
				while (i < keys.length) {
					value = parent[keys[i++]];
					parent = value;
				}
				elem.textContent = value;
			});
			document.documentElement.lang = json.this;
			break;
		}
	}
})();