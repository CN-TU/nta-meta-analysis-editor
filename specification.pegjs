{
  const NUMBER = "<free-integer>";
  const BOOLEAN = "<free-boolean>";
  const FEATURE = "<base-feature>";
  const ANYTHING = "<anything>"; // for unknown or error recovery
  var ParseWarning = options.ParseWarning;
  function VerbCheck(ret, context, hint) {
    this.ok = ret;
    this.newcontext = context;
    this.hint = hint || [];
  }
  function Variant(args, ret) {
    this.args = args;
    this.ret = ret;
  }
  function ComputedVariant(variant, context, hint) {
    this.args = variant.args;
    this.ret = variant.ret;
    this.context = context;
    this.hint = hint || [];
  }
  function down(context) {
      switch(context) {
        case "flows":
          return "packets";
        case "flow_aggregations":
          return "flows";
        default:
          return false;
      }
    }
  function down2(context) {
      if(context == "flow_aggregations")
        return "packets";
      return false;
  }
  function defChecker() {
    this.BASE = "<value>"; // where should we start?
    this.functions = new Map();
    this.verbs = new Map();
    this.spec_features = new Map();
    this.addFunction = function(name, args, ret) {
      args = args[0];
      let id = args.length;
      if (typeof args[args.length - 1] == "object" && args[args.length - 1].type == "oneormore") {
        id = 0;
        args[args.length - 1] = args[args.length - 1].term;
      }
      let variant = new Variant(args,ret)
      if (this.functions.has(name)) {
        if (this.functions.get(name)[id] !== undefined) {
          this.functions.get(name)[id].push(variant);
        } else {
          this.functions.get(name)[id] = [variant];
        }
      } else {
        let arr = []
        arr[id] = [variant];
        this.functions.set(name, arr);
      }
    }
    this.addVerb = function(name, ret) {
      if (name.startsWith('<')) {
        if (this.verbs.has(name)) {
          this.verbs.get(name).push(ret);
        } else {
          this.verbs.set(name, [ret]);
        }
      } else {
        this.spec_features.set(name, ret);
      }
    }
    this.arguments = function(item, want, err, context) {
      switch(item.type) {
        case "feature":
        case "number":
        case "boolean":
          return null;
        case "operation":
          let hints = [];
          let n = item.args.length;
          if (item.name.startsWith('__')) {
            return {variants:[new ComputedVariant(new Variant(Array(n).fill(ANYTHING), ANYTHING), context)]};
          }
          let variants = this.functions.get(item.name);
          if (variants === undefined) {
            let hint = [];
            if (item.name == "basedon") {
              hint.push("'basedon' was removed from the spec. Have a look at 'apply'.");
            }
            err.push(new ParseWarning("Operation '"+item.name+"' not found."+(hint.length > 0 ? [""].concat(hint).join(" ") : ""), item));
            return {variants:[new ComputedVariant(new Variant(Array(n).fill(ANYTHING), ANYTHING), context)]};
          }
          let ret = [];
          if (variants[n] !== undefined) {
            for(let variant of variants[n]) {
              if (want == undefined) {
                ret.push(new ComputedVariant(variant, context));
              } else {
                 let {ok, newcontext, hint} = this.compareVerbs(variant.ret, want, context);
                 if(ok) {
                   ret.push(new ComputedVariant(variant, newcontext, hint));
                 } else {
                   if (item.name == "map" && want == "<value>") {
                     hints.push("Did you mean 'apply'?");
                   }
                   hints = hints.concat(hint);
                 }
              }
            }
          }
          if (variants[0] !== undefined) {
            for(let variant of variants[0]) {
              if (n >= variant.args.length) {
                let v = variant.args.slice(0,-1);
                v = v.concat(Array(n-variant.args.length+1).fill(variant.args[variant.args.length - 1]));
                if (want == undefined) {
                  ret.push(new ComputedVariant(new Variant(v, variant.ret), context));
                } else {
                  let {ok, newcontext, hint} = this.compareVerbs(variant.ret, want, context);
                  if(ok) {
                    ret.push(new ComputedVariant(new Variant(v, variant.ret), newcontext, hint));
                  } else {
                    hints = hints.concat(hint);
                  }
                }
              }
            }
          }
          return {variants: ret, hints: hints};
      }
    }
    this.compareVerbs = function(a, want, context) {
      if (want == ANYTHING) return new VerbCheck(true, context);
      if (a == want) return new VerbCheck(true, context);
      let hint = [];
      if (this.verbs.has(a)) {
        for(let newa of this.verbs.get(a)) {
          let ret = this.compareVerbs(newa, want, context)
          if (ret.ok)
            return ret;
          hint.push(ret.hint);
        }
      }
      if(a == "<value>") {
        let d2ok = down2(context);
        if(d2ok === false) {
        } else {
          let ret = this.compareVerbs("<down2>", want, d2ok)
          if (ret.ok)
            return ret;
          hint.push(ret.hint);
        }
        let dok = down(context);
        if(dok === false) {
        } else {
          let ret = this.compareVerbs("<down>", want, dok)
          if (ret.ok) {
            return ret;
          }
          hint.push(ret.hint);
        }
        switch(want) {
          case "<down2>":
            hint.push("Only possible in 'flow_aggregations', but at this point context is '"+context+"'.");
            break;
          case "<down>":
          case "<values>":
            hint.push("Only possible in 'flow_aggregations' or 'flows', but at this point context is '"+context+"'.");
            break;
        }
      }
      return new VerbCheck(false, context, hint);
    }
    this.isValid = function(item, want, context) {
      return this.compareVerbs(this.type(item), want, context);
    }
    this.type = function(item) {
      switch(item.type) {
        case "number":
          return NUMBER;
        case "boolean":
          return BOOLEAN;
        case "feature":
          if(this.spec_features.has(item.name)) {
            return this.spec_features.get(item.name);
          }
          return FEATURE;
      }
      throw "Unknown item";
    }
  }

  var defs = new defChecker();

  function appendTerm(type, terms) {
    if (type == "<aggregation-feature>" || type == "<packet-feature>" || type == "<flow-feature>")
      return;
    for(let term of terms) {
      switch(typeof term) {
          case "string":
              defs.addVerb(term, type);
              continue;
          case "boolean":
              defs.addVerb(BOOLEAN, type);
              continue;
          case "object":
              let key=Object.keys(term)[0];
              defs.addFunction(key, term[key], type)
              continue;
      }
    }
  }
}

Specifications
  = specs:(spec:Specification? [ \t]* '\n' {return spec;})* { return defs; }

Specification
  = [ \t]* Comment {} /
    [ \t]* type:Type _ "->" _ terms:Terms [ \t]* Comment? { appendTerm(type, terms); }

Terms
  = head:Value tail:(_ '|' _ t:Value { return t;})* { return [head].concat(tail); }

Value
  = Null /
    t:Type _ '+' { return {type: 'oneormore', term:t}; }  /
  	Type /
    Object /
    Array /
    String /
    Bool

Object
  ='{' _ prop:Properties _ '}' { return prop; }

Properties
  = head:Property tail:(_ ',' _ p:Property { return p; })* { return Object.assign({}, head, ...tail); }
  
Property
  = key:String _ ':' _ value:Terms { let ret = {}; ret[key] = value; return ret }

Array
  = '[' head:Value tail:(_ ',' _ t:Value {return t;})* ']' {return [head].concat(tail);} 

Type
  = '<' ([^>]+) '>' { return text(); }
  
String
  = '"' s:([^"]+ {return text();}) '"' { return s; }
  
Null
  = 'null'i { return null; }

Bool
  = ('true'i/'false'i) { return text().toLowerCase() == "true"; }

Comment "Comment"
  = '#' [^\n]*

_ "whitespace"
  = [ \t]* (Comment? '\n')* [ \t]*
              