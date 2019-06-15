import { ContainerElement, CellElement, TimerElement, Record } from './minesweeper.js';

class PopUp extends HTMLElement {
	/**
	 * Create pop-up element.
	 * @param {Map<string, HTMLElement>} elements map of children
	 */
	constructor(elements) {
		super();
		this.elements = elements;
		const root = this.attachShadow({ mode: 'open' });
		const style = document.createElement('style');
		const div = document.createElement('div');
		div.append(...this.elements.values());
		root.append(style, div);
		this.css = `:host{background:rgba(255,255,255,.4);display:none;height:100%;left:0;position:fixed;text-align:center;top:0;width:100%}:host([open]){display:flex}div{background:#fff;border:1px solid #acf;border-radius:4px;margin:6em auto auto;padding:8px}div>*{display:block;margin:0 auto}`;
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

(function () {
	const form = document.forms.form;
	
	form.addEventListener('submit', createField);
	form.addEventListener('change', selectMode, { passive: true });
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
	
	function selectMode(e) {
		const values = e ? e.target.value.match(/(\d+)x(\d+),(\d+)/) : null;
		if (values) {
			values.forEach((v, i) => form[i].value = v);
			limitN();
			createField();
		} else {
			const valueList = Array.from(form.mode.options, option => option.value);
			const custom = form.x.value + 'x' + form.y.value + ',' + form.n.value;
			form.mode.value = valueList.includes(custom) ? custom : '';
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
			table.innerHTML = `<caption>スコア<a role=button href="javascript:localStorage.removeItem('score')">リセット</a><thead><th><th>タイム (s)<th>日付<tbody><tbody><tbody>`;
		}
		['easy', 'normal', 'hard'].forEach((type, i) => {
			const tbody = table.tBodies[i];
			tbody.innerHTML = '<tr><th><th colspan=2>' + form.mode.namedItem(type).textContent;
			const a = document.createElement('a');
			a.className = 'icon-delete';
			a.setAttribute('href', '#');
			a.setAttribute('role', 'button');
			a.setAttribute('title', '削除');
			tbody.append(...records[type].sort((a, b) => a.time - b.time).map(record => {
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

	function registerScore() {
		const wrapper = document.getElementById('wrapper');
		const container = wrapper.lastElementChild;
		if (container) {
			const mode = form.mode.selectedOptions[0].getAttribute('name');
			const score = JSON.parse(localStorage.getItem('score') || '{"easy":[],"normal":[],"hard":[]}');
			score[mode].push(new Record(container.timer));
			localStorage.setItem('score', JSON.stringify(score));
		}
	}

	/*
	POP-UP
	*/
	const strong = document.createElement('strong');
	const btn_func = document.createElement('button');
	btn_func.id = 'button';
	const btn_close = document.createElement('button');
	btn_close.textContent = '閉じる';
	const popup = new PopUp(new Map([
		['head', strong],
		['button', btn_func],
		['close', btn_close],
	]));
	popup.css = `.clear>strong::before{content:"クリア"}.clear>#button::before{content:"スコア記録"}.over>strong::before{content:"ゲームオーバー"}.over>#button::before{content:"リトライ"}`;
	btn_func.onclick = () => {
		const className = popup.shadowRoot.lastElementChild.className;
		if (className === 'clear') {
			registerScore();
			displayScore();
			popup.hide();
		} else if (className === 'over') {
			popup.hide();
			document.forms.form.button.click();
		}
	};
	btn_close.onclick = () => {
		popup.hide();
	};
	document.body.appendChild(popup);
})();